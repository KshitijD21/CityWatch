"""
Tests for download_data.py and geocode_data.py pipeline.
Verifies downloads, grid centroids, geocoding output, and idempotency.

Usage: cd backend && python -m pytest tests/test_pipeline.py -v
   or: cd backend/tests && python test_pipeline.py
"""

import csv
import json
import os
import sys
import unittest

# Data lives in backend/scripts/data/
SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "scripts")
DATA_DIR = os.path.join(SCRIPTS_DIR, "data")
GRID_FILE = os.path.join(DATA_DIR, "grid_centroids.json")

# Add scripts dir to path for idempotency test imports
sys.path.insert(0, SCRIPTS_DIR)


class TestDownloadData(unittest.TestCase):
    """Tests that download_data.py produced expected output files."""

    def test_data_dir_exists(self):
        self.assertTrue(os.path.isdir(DATA_DIR), "backend/scripts/data/ directory missing — run download_data.py")

    def test_crime_csv_exists_and_nonempty(self):
        path = os.path.join(DATA_DIR, "crime_data.csv")
        self.assertTrue(os.path.exists(path), "crime_data.csv missing")
        self.assertGreater(os.path.getsize(path), 1_000_000, "crime_data.csv seems too small")

    def test_calls_csv_exists_and_nonempty(self):
        path = os.path.join(DATA_DIR, "calls_for_service_2025.csv")
        self.assertTrue(os.path.exists(path), "calls_for_service_2025.csv missing")
        self.assertGreater(os.path.getsize(path), 1_000_000, "calls_for_service_2025.csv seems too small")

    def test_grid_centroids_exists(self):
        self.assertTrue(os.path.exists(GRID_FILE), "grid_centroids.json missing")

    def test_grid_centroids_has_entries(self):
        with open(GRID_FILE) as f:
            grids = json.load(f)
        self.assertGreater(len(grids), 2000, f"Expected 2000+ grids, got {len(grids)}")

    def test_grid_centroid_structure(self):
        with open(GRID_FILE) as f:
            grids = json.load(f)
        for code, coords in list(grids.items())[:10]:
            self.assertIn("lat", coords, f"Grid {code} missing 'lat'")
            self.assertIn("lng", coords, f"Grid {code} missing 'lng'")
            self.assertIsInstance(coords["lat"], float)
            self.assertIsInstance(coords["lng"], float)

    def test_grid_centroids_in_phoenix_area(self):
        """All centroids should be roughly in the Phoenix metro area."""
        with open(GRID_FILE) as f:
            grids = json.load(f)
        for code, coords in grids.items():
            self.assertGreater(coords["lat"], 33.0, f"Grid {code} lat {coords['lat']} too far south")
            self.assertLess(coords["lat"], 34.0, f"Grid {code} lat {coords['lat']} too far north")
            self.assertGreater(coords["lng"], -113.0, f"Grid {code} lng {coords['lng']} too far west")
            self.assertLess(coords["lng"], -111.0, f"Grid {code} lng {coords['lng']} too far east")

    def test_crime_csv_headers(self):
        path = os.path.join(DATA_DIR, "crime_data.csv")
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        for col in ["INC NUMBER", "OCCURRED ON", "UCR CRIME CATEGORY", "100 BLOCK ADDR", "GRID"]:
            self.assertIn(col, headers, f"Missing column '{col}' in crime_data.csv")

    def test_calls_csv_headers(self):
        path = os.path.join(DATA_DIR, "calls_for_service_2025.csv")
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        for col in ["INCIDENT_NUM", "FINAL_CALL_TYPE", "CALL_RECEIVED", "HUNDREDBLOCKADDR", "GRID"]:
            self.assertIn(col, headers, f"Missing column '{col}' in calls_for_service_2025.csv")


class TestGeocodeData(unittest.TestCase):
    """Tests that geocode_data.py produced correctly enriched CSVs."""

    def test_crime_geo_csv_exists(self):
        path = os.path.join(DATA_DIR, "crime_data_geo.csv")
        self.assertTrue(os.path.exists(path), "crime_data_geo.csv missing — run geocode_data.py")

    def test_calls_geo_csv_exists(self):
        path = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")
        self.assertTrue(os.path.exists(path), "calls_for_service_2025_geo.csv missing — run geocode_data.py")

    def test_crime_geo_has_lat_lng_columns(self):
        path = os.path.join(DATA_DIR, "crime_data_geo.csv")
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        self.assertIn("lat", headers)
        self.assertIn("lng", headers)

    def test_calls_geo_has_lat_lng_columns(self):
        path = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        self.assertIn("lat", headers)
        self.assertIn("lng", headers)

    def test_crime_geo_high_match_rate(self):
        """At least 99% of rows should have coordinates."""
        path = os.path.join(DATA_DIR, "crime_data_geo.csv")
        total = 0
        with_coords = 0
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                total += 1
                if row["lat"] and row["lng"]:
                    with_coords += 1
        rate = with_coords / total if total else 0
        self.assertGreater(rate, 0.99, f"Only {rate:.1%} of crime rows have coords (expected >99%)")

    def test_calls_geo_high_match_rate(self):
        """At least 99% of rows should have coordinates."""
        path = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")
        total = 0
        with_coords = 0
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                total += 1
                if row["lat"] and row["lng"]:
                    with_coords += 1
        rate = with_coords / total if total else 0
        self.assertGreater(rate, 0.99, f"Only {rate:.1%} of calls rows have coords (expected >99%)")

    def test_crime_geo_coords_in_phoenix(self):
        """Spot-check first 100 rows with coords are in Phoenix area."""
        path = os.path.join(DATA_DIR, "crime_data_geo.csv")
        checked = 0
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row["lat"] or not row["lng"]:
                    continue
                lat, lng = float(row["lat"]), float(row["lng"])
                self.assertGreater(lat, 33.0, f"lat {lat} too far south")
                self.assertLess(lat, 34.0, f"lat {lat} too far north")
                self.assertGreater(lng, -113.0, f"lng {lng} too far west")
                self.assertLess(lng, -111.0, f"lng {lng} too far east")
                checked += 1
                if checked >= 100:
                    break

    def test_calls_geo_coords_in_phoenix(self):
        """Spot-check first 100 rows with coords are in Phoenix area."""
        path = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")
        checked = 0
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if not row["lat"] or not row["lng"]:
                    continue
                lat, lng = float(row["lat"]), float(row["lng"])
                self.assertGreater(lat, 33.0, f"lat {lat} too far south")
                self.assertLess(lat, 34.0, f"lat {lat} too far north")
                self.assertGreater(lng, -113.0, f"lng {lng} too far west")
                self.assertLess(lng, -111.0, f"lng {lng} too far east")
                checked += 1
                if checked >= 100:
                    break

    def test_crime_geo_row_count_matches_original(self):
        """Geocoded file should have same number of rows as original."""
        orig = os.path.join(DATA_DIR, "crime_data.csv")
        geo = os.path.join(DATA_DIR, "crime_data_geo.csv")
        with open(orig) as f:
            orig_count = sum(1 for _ in f) - 1
        with open(geo) as f:
            geo_count = sum(1 for _ in f) - 1
        self.assertEqual(orig_count, geo_count, f"Row count mismatch: original={orig_count}, geo={geo_count}")

    def test_calls_geo_row_count_matches_original(self):
        """Geocoded file should have same number of rows as original."""
        orig = os.path.join(DATA_DIR, "calls_for_service_2025.csv")
        geo = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")
        with open(orig) as f:
            orig_count = sum(1 for _ in f) - 1
        with open(geo) as f:
            geo_count = sum(1 for _ in f) - 1
        self.assertEqual(orig_count, geo_count, f"Row count mismatch: original={orig_count}, geo={geo_count}")


class TestIdempotency(unittest.TestCase):
    """Test that rerunning scripts doesn't duplicate or corrupt data."""

    def test_download_idempotent(self):
        """Running download_data twice should not change file sizes."""
        crime = os.path.join(DATA_DIR, "crime_data.csv")
        calls = os.path.join(DATA_DIR, "calls_for_service_2025.csv")
        grid = os.path.join(DATA_DIR, "grid_centroids.json")

        sizes_before = {
            "crime": os.path.getsize(crime),
            "calls": os.path.getsize(calls),
            "grid": os.path.getsize(grid),
        }

        import download_data
        download_data.main()

        sizes_after = {
            "crime": os.path.getsize(crime),
            "calls": os.path.getsize(calls),
            "grid": os.path.getsize(grid),
        }

        self.assertEqual(sizes_before, sizes_after, "File sizes changed on rerun")

    def test_geocode_idempotent(self):
        """Running geocode_data twice should not change output files."""
        crime_geo = os.path.join(DATA_DIR, "crime_data_geo.csv")
        calls_geo = os.path.join(DATA_DIR, "calls_for_service_2025_geo.csv")

        sizes_before = {
            "crime_geo": os.path.getsize(crime_geo),
            "calls_geo": os.path.getsize(calls_geo),
        }

        import geocode_data
        geocode_data.main()

        sizes_after = {
            "crime_geo": os.path.getsize(crime_geo),
            "calls_geo": os.path.getsize(calls_geo),
        }

        self.assertEqual(sizes_before, sizes_after, "Geocoded file sizes changed on rerun")


if __name__ == "__main__":
    unittest.main(verbosity=2)
