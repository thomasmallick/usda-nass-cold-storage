#!/usr/bin/env python3
"""
Validate data/cold-storage-archive.json — shape, ordering, and value sanity.

Run locally or in CI:
  python3 scripts/validate-archive.py          # exit 0 = healthy
  python3 scripts/validate-archive.py --strict # warnings also fail

No third-party dependencies.
"""

import argparse
import datetime
import json
import sys
from pathlib import Path

ARCHIVE = Path(__file__).parent.parent / "data" / "cold-storage-archive.json"

HEADLINE_KEYS = [
    "butter", "american_cheese", "swiss_cheese", "other_natural_cheese",
    "total_natural_cheese", "total_chicken", "total_turkey",
    "total_frozen_poultry", "total_frozen_fruit", "total_frozen_vegetables",
    "total_frozen_potatoes", "total_beef", "pork_bellies", "total_pork",
    "total_frozen_red_meat",
]

AGGREGATE_FLOORS = [
    ("total_frozen_poultry", ["total_chicken", "total_turkey"]),
    ("total_frozen_red_meat", ["total_beef", "total_pork"]),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="treat warnings as errors")
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    try:
        archive = json.loads(ARCHIVE.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot load {ARCHIVE}: {exc}", file=sys.stderr)
        sys.exit(1)

    # Shape
    if not isinstance(archive.get("meta"), dict):
        errors.append("meta missing or not an object")
    if archive.get("meta", {}).get("units") != "1000 lb":
        warnings.append(f"meta.units is {archive.get('meta', {}).get('units')!r}, expected '1000 lb'")
    snaps = archive.get("snapshots")
    if not isinstance(snaps, list) or not snaps:
        print("ERROR: snapshots missing or empty", file=sys.stderr)
        sys.exit(1)

    # Ordering, duplicates, per-snapshot checks
    seen_dates = set()
    prev_date = None
    for i, s in enumerate(snaps):
        date = s.get("observationDate", "")
        try:
            parsed = datetime.date.fromisoformat(date)
        except ValueError:
            errors.append(f"snapshot {i}: bad observationDate {date!r}")
            continue
        if date in seen_dates:
            errors.append(f"duplicate snapshot for {date}")
        seen_dates.add(date)
        if prev_date and parsed <= prev_date:
            errors.append(f"snapshots out of order at {date}")
        prev_date = parsed

        commodities = s.get("commodities")
        if not isinstance(commodities, dict) or not commodities:
            errors.append(f"{date}: commodities missing or empty")
            continue
        for key, value in commodities.items():
            if not isinstance(value, int) or value <= 0:
                errors.append(f"{date}: {key} = {value!r} (expected positive int, 1000 lb)")

        for agg, parts in AGGREGATE_FLOORS:
            if commodities.get(agg) and all(commodities.get(p) for p in parts):
                floor = sum(commodities[p] for p in parts) * 0.98
                if commodities[agg] < floor:
                    errors.append(f"{date}: {agg} below sum of components — partial aggregate")

    # Latest snapshot must be complete and recent
    latest = snaps[-1]
    missing = [k for k in HEADLINE_KEYS if not latest.get("commodities", {}).get(k)]
    if missing:
        errors.append(f"latest snapshot ({latest.get('observationDate')}) missing headline keys: {', '.join(missing)}")

    latest_date = datetime.date.fromisoformat(latest["observationDate"])
    age_days = (datetime.date.today() - latest_date).days
    if age_days > 75:
        warnings.append(f"latest snapshot is {age_days} days old — cron may be failing")

    # Gap report (historical holes are warnings, not failures)
    gap_count = sum(
        1 for s in snaps for k in HEADLINE_KEYS if not s["commodities"].get(k)
    )
    if gap_count:
        warnings.append(f"{gap_count} missing headline values across {len(snaps)} snapshots (run fetch-usda.py --repair)")

    for w in warnings:
        print(f"WARN: {w}")
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    if errors or (args.strict and warnings):
        sys.exit(1)
    print(f"Archive healthy: {len(snaps)} snapshots, {snaps[0]['observationDate']} → {snaps[-1]['observationDate']}")


if __name__ == "__main__":
    main()
