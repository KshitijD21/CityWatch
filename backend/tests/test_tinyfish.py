"""
Tests for TinyFish scraper service: item parsing, normalization,
smart-linking, and dedup logic.

All tests mock external calls (TinyFish SDK, InsForge DB, OpenAI).
"""

import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend/ to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock config before importing tinyfish_service
sys.modules["config"] = MagicMock(
    TINYFISH_API_KEY="test-key",
    MAPBOX_TOKEN="test-mapbox-token",
    INSFORGE_URL="https://test.insforge.app",
    INSFORGE_API_KEY="test-insforge-key",
    OPENAI_API_KEY=None,  # No real OpenAI calls in tests
)

from services.tinyfish_service import (
    _generate_external_id,
    _parse_date,
    _get_field,
    _extract_items,
    _extract_phoenix_location,
    parse_police_item,
    parse_news_item,
    parse_reddit_item,
)
from utils.normalize import normalize_category


# ---------------------------------------------------------------------------
# Date Parsing
# ---------------------------------------------------------------------------


class TestParseDate(unittest.TestCase):

    def test_iso_format(self):
        dt = _parse_date("2026-03-20")
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 3)
        self.assertEqual(dt.day, 20)

    def test_us_format(self):
        dt = _parse_date("03/20/2026")
        self.assertEqual(dt.month, 3)
        self.assertEqual(dt.day, 20)

    def test_long_format(self):
        dt = _parse_date("March 20, 2026")
        self.assertEqual(dt.month, 3)

    def test_with_time(self):
        dt = _parse_date("2026-03-20", "14:30")
        self.assertEqual(dt.hour, 14)
        self.assertEqual(dt.minute, 30)

    def test_time_pm_comma_format(self):
        """TinyFish news format: '6:21 PM, Mar 21, 2026'"""
        dt = _parse_date("6:21 PM, Mar 21, 2026")
        self.assertIsNotNone(dt)
        self.assertEqual(dt.month, 3)
        self.assertEqual(dt.day, 21)
        self.assertEqual(dt.hour, 18)
        self.assertEqual(dt.minute, 21)

    def test_empty_returns_none(self):
        self.assertIsNone(_parse_date(""))
        self.assertIsNone(_parse_date("not-a-date"))


# ---------------------------------------------------------------------------
# Get Field Helper
# ---------------------------------------------------------------------------


class TestGetField(unittest.TestCase):

    def test_first_match(self):
        raw = {"type": "Assault", "crime_type": "Battery"}
        self.assertEqual(_get_field(raw, "type", "crime_type"), "Assault")

    def test_fallback(self):
        raw = {"crime_type": "Battery"}
        self.assertEqual(_get_field(raw, "type", "crime_type"), "Battery")

    def test_empty_returns_empty(self):
        raw = {"type": ""}
        self.assertEqual(_get_field(raw, "type"), "")

    def test_none_value_skipped(self):
        raw = {"type": None, "crime_type": "Theft"}
        self.assertEqual(_get_field(raw, "type", "crime_type"), "Theft")


# ---------------------------------------------------------------------------
# Extract Items
# ---------------------------------------------------------------------------


class TestExtractItems(unittest.TestCase):

    def test_list_passthrough(self):
        self.assertEqual(_extract_items([{"a": 1}]), [{"a": 1}])

    def test_unwrap_dict(self):
        result = _extract_items({"articles": [{"a": 1}]})
        self.assertEqual(result, [{"a": 1}])

    def test_single_dict(self):
        result = _extract_items({"name": "test"})
        self.assertEqual(result, [{"name": "test"}])

    def test_none_returns_empty(self):
        self.assertEqual(_extract_items(None), [])


# ---------------------------------------------------------------------------
# External ID Generation
# ---------------------------------------------------------------------------


class TestGenerateExternalId(unittest.TestCase):

    def test_uses_provided_id(self):
        raw = {"external_id": "CASE-2026-001"}
        self.assertEqual(_generate_external_id("police", raw), "CASE-2026-001")

    def test_generates_hash_when_no_id(self):
        raw = {"date": "2026-03-20", "description": "Armed robbery at 7th Ave"}
        ext_id = _generate_external_id("police", raw)
        self.assertEqual(len(ext_id), 16)

    def test_stable_hash(self):
        raw = {"date": "2026-03-20", "description": "Test"}
        id1 = _generate_external_id("police", raw)
        id2 = _generate_external_id("police", raw)
        self.assertEqual(id1, id2)


# ---------------------------------------------------------------------------
# Police Item Parsing
# ---------------------------------------------------------------------------


class TestParsePoliceItem(unittest.TestCase):

    @patch("services.tinyfish_service.normalize_location")
    def test_valid_item(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}

        raw = {
            "date": "2026-03-20",
            "time": "14:30",
            "type": "Armed Robbery",
            "location": "1st Ave and Main St, Phoenix, AZ",
            "description": "Suspect robbed store at gunpoint",
            "external_id": "2026-001234",
            "url": "https://example.com/report",
        }
        result = parse_police_item(raw)
        self.assertIsNotNone(result)

        incident, source = result
        self.assertEqual(incident["category"], "assault")  # armed robbery → assault
        self.assertEqual(incident["source"], "police")
        self.assertTrue(incident["verified"])
        self.assertEqual(incident["lat"], 33.45)
        self.assertEqual(source["source_name"], "tinyfish_police")
        self.assertEqual(source["external_id"], "2026-001234")

    def test_missing_type_returns_none(self):
        raw = {"date": "2026-03-20", "location": "Phoenix, AZ"}
        self.assertIsNone(parse_police_item(raw))

    def test_missing_location_returns_none(self):
        raw = {"date": "2026-03-20", "type": "Theft"}
        self.assertIsNone(parse_police_item(raw))

    def test_missing_date_returns_none(self):
        raw = {"type": "Theft", "location": "Phoenix, AZ"}
        self.assertIsNone(parse_police_item(raw))

    @patch("services.tinyfish_service.normalize_location")
    def test_other_category_skipped(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}
        raw = {
            "date": "2026-03-20",
            "type": "Welfare Check",
            "location": "Phoenix, AZ",
        }
        self.assertIsNone(parse_police_item(raw))

    @patch("services.tinyfish_service.normalize_location")
    def test_real_phoenix_pd_format(self, mock_geo):
        """Test with actual Phoenix PD TinyFish response field names."""
        mock_geo.return_value = {"lat": 33.43, "lng": -112.09}
        raw = {
            "headline": "Critical Incident Briefing - February 27, 2026",
            "date": "February 27, 2026",
            "type_of_incident": "Officer-involved shooting",
            "location": "1900 W Durango St.",
            "url": "https://www.phoenix.gov/newsroom/police/ois-feb-27",
        }
        result = parse_police_item(raw)
        self.assertIsNotNone(result)
        incident, source = result
        self.assertEqual(incident["category"], "assault")
        self.assertEqual(incident["lat"], 33.43)
        self.assertEqual(source["url"], "https://www.phoenix.gov/newsroom/police/ois-feb-27")

    @patch("services.tinyfish_service.normalize_location")
    def test_zero_coords_returns_none(self, mock_geo):
        mock_geo.return_value = {"lat": 0.0, "lng": 0.0}
        raw = {
            "date": "2026-03-20",
            "type": "Assault",
            "location": "Unknown",
        }
        self.assertIsNone(parse_police_item(raw))


# ---------------------------------------------------------------------------
# News Item Parsing
# ---------------------------------------------------------------------------


class TestParseNewsItem(unittest.TestCase):

    @patch("services.tinyfish_service.normalize_location")
    def test_valid_news_item(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}

        raw = {
            "headline": "Fatal shooting near downtown Phoenix",
            "summary": "A man was shot and killed near downtown Phoenix late Tuesday.",
            "location": "3rd St and Van Buren, Phoenix, AZ",
            "date": "2026-03-20",
            "url": "https://azcentral.com/article/123",
        }
        result = parse_news_item(raw)
        self.assertIsNotNone(result)

        incident, source = result
        self.assertEqual(incident["category"], "assault")
        self.assertEqual(incident["source"], "news")
        self.assertFalse(incident["verified"])
        self.assertEqual(source["source_name"], "tinyfish_news")
        self.assertEqual(source["external_id"], "https://azcentral.com/article/123")

    @patch("services.tinyfish_service.normalize_location")
    def test_falls_back_to_summary_for_category(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}

        raw = {
            "headline": "Breaking news in Phoenix",  # no category keywords
            "summary": "A smash and grab was reported at a parking garage",
            "location": "Phoenix, AZ",
            "date": "2026-03-20",
            "url": "https://example.com/1",
        }
        result = parse_news_item(raw)
        self.assertIsNotNone(result)
        self.assertEqual(result[0]["category"], "vehicle_breakin")

    def test_missing_headline_returns_none(self):
        raw = {"location": "Phoenix, AZ", "date": "2026-03-20"}
        self.assertIsNone(parse_news_item(raw))

    @patch("services.tinyfish_service.normalize_location")
    def test_url_as_external_id(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}

        raw = {
            "headline": "Theft spree in Tempe",
            "location": "Tempe, AZ",
            "date": "2026-03-20",
            "url": "https://abc15.com/news/theft-spree",
        }
        result = parse_news_item(raw)
        self.assertEqual(result[1]["external_id"], "https://abc15.com/news/theft-spree")


# ---------------------------------------------------------------------------
# Normalize Category — Keywords
# ---------------------------------------------------------------------------


class TestNormalizeCategoryKeywords(unittest.TestCase):

    def test_armed_robbery_maps_to_assault_not_theft(self):
        self.assertEqual(normalize_category("Armed Robbery at Gas Station"), "assault")

    def test_fatal_shooting_maps_to_assault(self):
        self.assertEqual(normalize_category("Fatal Shooting near downtown"), "assault")

    def test_officer_involved_shooting_maps_to_assault(self):
        self.assertEqual(normalize_category("Officer-Involved Shooting"), "assault")

    def test_vehicle_burglary_maps_to_vehicle_breakin(self):
        self.assertEqual(normalize_category("Vehicle Burglary Report"), "vehicle_breakin")

    def test_smash_and_grab_maps_to_vehicle_breakin(self):
        self.assertEqual(normalize_category("Smash and Grab at parking lot"), "vehicle_breakin")

    def test_road_rage_maps_to_disturbance(self):
        self.assertEqual(normalize_category("Road Rage Incident on I-10"), "disturbance")

    def test_police_chase_maps_to_disturbance(self):
        self.assertEqual(normalize_category("Police Chase Ends in Tempe"), "disturbance")

    def test_fatal_crash_maps_to_disturbance(self):
        self.assertEqual(normalize_category("Fatal Crash on Loop 101"), "disturbance")

    def test_wrong_way_driver_maps_to_disturbance(self):
        self.assertEqual(normalize_category("Wrong-Way Driver on I-17"), "disturbance")

    def test_kidnapping_maps_to_harassment(self):
        self.assertEqual(normalize_category("Kidnapping Suspect Arrested"), "harassment")

    def test_amber_alert_maps_to_harassment(self):
        self.assertEqual(normalize_category("AMBER Alert Issued for Phoenix"), "harassment")

    def test_indecent_exposure_maps_to_harassment(self):
        self.assertEqual(normalize_category("Indecent Exposure at Park"), "harassment")

    def test_package_theft_maps_to_theft(self):
        self.assertEqual(normalize_category("Package Theft on the Rise"), "theft")

    def test_catalytic_converter_maps_to_theft(self):
        self.assertEqual(normalize_category("Catalytic Converter Theft Ring"), "theft")

    def test_motor_vehicle_theft_still_vehicle_breakin(self):
        self.assertEqual(normalize_category("MOTOR VEHICLE THEFT"), "vehicle_breakin")

    def test_domestic_violence_still_assault(self):
        self.assertEqual(normalize_category("DOMESTIC VIOLENCE"), "assault")


# ---------------------------------------------------------------------------
# Smart-Linking
# ---------------------------------------------------------------------------


class TestFindMatchingIncident(unittest.TestCase):

    def setUp(self):
        from services.tinyfish_service import find_matching_incident
        self.find_matching = find_matching_incident

    def _make_mock_db(self, select_results):
        db = AsyncMock()
        db.select = AsyncMock(return_value=select_results)
        return db

    def test_matches_nearby_same_category_recent(self):
        import asyncio

        db = self._make_mock_db([
            {
                "id": "abc-123",
                "lat": 33.4500,
                "lng": -112.0700,
                "occurred_at": "2026-03-20T14:00:00",
            }
        ])
        result = asyncio.run(
            self.find_matching(db, "assault", 33.4505, -112.0705, "2026-03-20T16:00:00")
        )
        self.assertEqual(result, "abc-123")

    def test_no_match_different_category(self):
        import asyncio

        db = self._make_mock_db([])
        result = asyncio.run(
            self.find_matching(db, "theft", 33.45, -112.07, "2026-03-20T14:00:00")
        )
        self.assertIsNone(result)

    def test_no_match_too_far_away(self):
        import asyncio

        db = self._make_mock_db([
            {
                "id": "abc-123",
                "lat": 33.50,  # ~3.5 miles away
                "lng": -112.07,
                "occurred_at": "2026-03-20T14:00:00",
            }
        ])
        result = asyncio.run(
            self.find_matching(db, "assault", 33.45, -112.07, "2026-03-20T16:00:00")
        )
        self.assertIsNone(result)

    def test_no_match_too_old(self):
        import asyncio

        db = self._make_mock_db([
            {
                "id": "abc-123",
                "lat": 33.4500,
                "lng": -112.0700,
                "occurred_at": "2026-03-10T14:00:00",  # 10 days ago
            }
        ])
        result = asyncio.run(
            self.find_matching(db, "assault", 33.4505, -112.0705, "2026-03-20T16:00:00")
        )
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# Reddit Location Extraction
# ---------------------------------------------------------------------------


class TestExtractPhoenixLocation(unittest.TestCase):

    def test_street_address(self):
        loc = _extract_phoenix_location("Shooting at 1900 W Durango St last night")
        self.assertIn("1900 W Durango St", loc)
        self.assertIn("Phoenix, AZ", loc)

    def test_named_area(self):
        loc = _extract_phoenix_location("Car stolen in Maryvale today")
        self.assertEqual(loc, "Maryvale, AZ")

    def test_tempe(self):
        loc = _extract_phoenix_location("Break-in reported in Tempe near campus")
        self.assertEqual(loc, "Tempe, AZ")

    def test_no_location(self):
        loc = _extract_phoenix_location("Just saw something weird happen")
        self.assertEqual(loc, "")

    def test_freeway_reference(self):
        loc = _extract_phoenix_location("Wrong-way driver on I-17 near Thunderbird")
        self.assertIn("Phoenix, AZ", loc)


# ---------------------------------------------------------------------------
# Reddit Item Parsing
# ---------------------------------------------------------------------------


class TestParseRedditItem(unittest.TestCase):

    @patch("services.tinyfish_service.normalize_location")
    def test_valid_reddit_item(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}

        raw = {
            "headline": "Armed robbery at gas station in Maryvale",
            "summary": "Guy pulled a gun at the Circle K on 51st Ave",
            "location": "Maryvale, AZ",
            "date": "2026-03-21",
            "url": "https://www.reddit.com/r/phoenix/comments/abc123",
            "_reddit_id": "abc123",
        }
        result = parse_reddit_item(raw)
        self.assertIsNotNone(result)

        incident, source = result
        self.assertEqual(incident["source"], "community")
        self.assertFalse(incident["verified"])
        self.assertEqual(source["source_name"], "reddit")
        self.assertEqual(source["source_type"], "community")
        self.assertEqual(source["external_id"], "https://www.reddit.com/r/phoenix/comments/abc123")

    def test_missing_headline_returns_none(self):
        raw = {"location": "Phoenix, AZ", "date": "2026-03-21"}
        self.assertIsNone(parse_reddit_item(raw))

    def test_missing_location_returns_none(self):
        raw = {"headline": "Something happened", "date": "2026-03-21"}
        self.assertIsNone(parse_reddit_item(raw))

    @patch("services.tinyfish_service.normalize_location")
    def test_non_safety_post_returns_none(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}
        raw = {
            "headline": "Best tacos in Phoenix?",
            "summary": "Looking for good taco spots",
            "location": "Phoenix, AZ",
            "date": "2026-03-21",
        }
        self.assertIsNone(parse_reddit_item(raw))

    @patch("services.tinyfish_service.normalize_location")
    def test_reddit_id_as_fallback_external_id(self, mock_geo):
        mock_geo.return_value = {"lat": 33.45, "lng": -112.07}
        raw = {
            "headline": "Shooting near downtown Phoenix",
            "location": "Downtown Phoenix, AZ",
            "date": "2026-03-21",
            "_reddit_id": "xyz789",
        }
        result = parse_reddit_item(raw)
        self.assertIsNotNone(result)
        self.assertEqual(result[1]["external_id"], "reddit:xyz789")


if __name__ == "__main__":
    unittest.main()
