#!/usr/bin/env python3
"""
Live test: OpenAI classifier + Nominatim geocoding.
Tests real API calls — run manually, not in CI.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from utils.normalize import classify_incident, classify_batch, normalize_location

SEPARATOR = "=" * 60


def test_classifier():
    print(f"\n{SEPARATOR}")
    print("OPENAI CLASSIFIER TEST")
    print(SEPARATOR)

    # These are real examples that keyword matching missed
    test_cases = [
        # (text, expected_category)
        ("Fatal Collision", "disturbance"),
        ("Fatal Hit and Run Collision", "disturbance"),
        ("Fatal Collision (pedestrian struck)", "disturbance"),
        ("Extreme Heat Warning / Safety Restriction", "other"),
        ("Heat Safety Measure", "other"),
        ("Crescent Moon display on Tempe's 'A' Mountain destroyed; Muslim community calls for tolerance", "vandalism"),
        ("Phoenix police investigate two separate hit-and-run crashes leaving one dead", "disturbance"),
        ("Phoenix police search for suspect after early morning shooting leaves man seriously hurt", "assault"),
        ("Phoenix speed enforcement camera vandalised, shot and removed", "vandalism"),
        ("Two people hurt after shooting at store near I-17 and Thunderbird Road", "assault"),
        ("Aggravated Assault Investigation (shooting at police helicopter)", "assault"),
        ("Officer Involved Shooting", "assault"),
        ("Aggravated Assault (shoplifter injured off-duty officer)", "assault"),
    ]

    passed = 0
    failed = 0

    for text, expected in test_cases:
        result = classify_incident(text)
        status = "PASS" if result == expected else "FAIL"
        if status == "FAIL":
            failed += 1
            print(f"  {status}: '{text[:60]}' → {result} (expected {expected})")
        else:
            passed += 1
            print(f"  {status}: '{text[:60]}' → {result}")

    print(f"\n  Results: {passed}/{len(test_cases)} passed, {failed} failed")


def test_batch_classifier():
    print(f"\n{SEPARATOR}")
    print("OPENAI BATCH CLASSIFIER TEST")
    print(SEPARATOR)

    texts = [
        "Fatal Collision",
        "Armed Robbery at Gas Station",
        "Phoenix speed camera destroyed",
        "Heat Safety Advisory",
        "Officer Involved Shooting",
    ]
    expected = ["disturbance", "assault", "vandalism", "other", "assault"]

    results = classify_batch(texts)
    for text, exp, got in zip(texts, expected, results):
        status = "PASS" if got == exp else "FAIL"
        print(f"  {status}: '{text[:50]}' → {got} (expected {exp})")


def test_nominatim():
    print(f"\n{SEPARATOR}")
    print("NOMINATIM GEOCODING TEST")
    print(SEPARATOR)

    test_addresses = [
        "4200 West Orangewood Avenue, Phoenix, AZ",
        "4000 West Grand Avenue, Phoenix, AZ",
        "3700 West Thomas Road, Phoenix, AZ",
        "Cave Creek and Greenway roads, Phoenix, AZ",
        "19th Avenue and Thunderbird Road, Phoenix, AZ",
        "'A' Mountain, Tempe, AZ",
        "Interstate 17 and Thunderbird Road, Phoenix, AZ",
    ]

    for addr in test_addresses:
        coords = normalize_location(addr)
        lat, lng = coords["lat"], coords["lng"]
        if lat == 0.0 and lng == 0.0:
            print(f"  FAIL: '{addr}' → no result")
        else:
            # Check if roughly in Phoenix/Tempe area (lat ~33.3-33.7, lng ~-112.3 to -111.7)
            in_area = 33.2 < lat < 33.8 and -112.5 < lng < -111.5
            status = "PASS" if in_area else "WARN"
            print(f"  {status}: '{addr}' → ({lat:.4f}, {lng:.4f})")


if __name__ == "__main__":
    test_classifier()
    test_batch_classifier()
    test_nominatim()
