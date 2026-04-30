#!/usr/bin/env python3
"""
Fetch USDA NASS cold storage data and update data/cold-storage-archive.json.

Usage:
  python scripts/fetch-usda.py                    # fetch latest available month
  python scripts/fetch-usda.py --backfill 60      # fetch last 60 months
  python scripts/fetch-usda.py --month 2025-06    # fetch a specific month
  python scripts/fetch-usda.py --explore butter   # print raw API response (no write)

Requires: USDA_API_KEY environment variable
  Register free at: https://quickstats.nass.usda.gov/api

How USDA Quick Stats works for cold storage:
  - source_desc = SURVEY
  - statisticcat_desc = COLD STORAGE
  - unit_desc = 1000 LB
  - freq_desc = MONTHLY
  - Each commodity / item combo maps to a unique short_desc in the API.
  - The release_date field shows when USDA published that month's data.
  - Use --explore to inspect what fields the API returns before editing COMMODITY_MAP.
"""

import os
import sys
import json
import argparse
import datetime
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
ARCHIVE_PATH = REPO_ROOT / "data" / "cold-storage-archive.json"
API_BASE = "https://quickstats.nass.usda.gov/api/api_GET/"

# ---------------------------------------------------------------------------
# Commodity map: our internal key → USDA Quick Stats query parameters.
#
# The most reliable filter is `short_desc`, which is the full item string
# exactly as USDA uses it.  Use --explore <key> to print what USDA returns
# and verify/correct these strings.
#
# Format of short_desc: "{ITEM} - COLD STORAGE, MEASURED IN 1000 LB"
# ---------------------------------------------------------------------------
COMMODITY_MAP: dict[str, dict] = {
    "butter": {
        "commodity_desc": "BUTTER",
        "short_desc": "BUTTER - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "american_cheese": {
        "commodity_desc": "CHEESE",
        "short_desc": "CHEESE, AMERICAN TYPE - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "swiss_cheese": {
        "commodity_desc": "CHEESE",
        "short_desc": "CHEESE, SWISS TYPE - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "other_natural_cheese": {
        "commodity_desc": "CHEESE",
        "short_desc": "CHEESE, OTHER NATURAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_natural_cheese": {
        "commodity_desc": "CHEESE",
        "short_desc": "CHEESE, NATURAL TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_chicken": {
        "commodity_desc": "CHICKENS",
        "short_desc": "CHICKENS, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_turkey": {
        "commodity_desc": "TURKEYS",
        "short_desc": "TURKEYS, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_frozen_poultry": {
        "commodity_desc": "POULTRY",
        "short_desc": "POULTRY, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_frozen_fruit": {
        "commodity_desc": "FRUIT & TREE NUTS",
        "short_desc": "FRUIT, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_frozen_vegetables": {
        "commodity_desc": "VEGETABLES",
        "short_desc": "VEGETABLES, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_frozen_potatoes": {
        "commodity_desc": "POTATOES",
        "short_desc": "POTATOES, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_beef": {
        "commodity_desc": "CATTLE",
        "short_desc": "BEEF, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "pork_bellies": {
        "commodity_desc": "HOGS",
        "short_desc": "PORK BELLIES, FROZEN - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_pork": {
        "commodity_desc": "HOGS",
        "short_desc": "PORK, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
    "total_frozen_red_meat": {
        "commodity_desc": "RED MEAT",
        "short_desc": "RED MEAT, FROZEN, TOTAL - COLD STORAGE, MEASURED IN 1000 LB",
    },
}

PERIOD_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
def get_api_key() -> str:
    key = os.environ.get("USDA_API_KEY", "").strip()
    if not key:
        print("ERROR: USDA_API_KEY environment variable not set.", file=sys.stderr)
        print("  Register free at: https://quickstats.nass.usda.gov/api", file=sys.stderr)
        sys.exit(1)
    return key


def api_get(params: dict, retries: int = 3) -> dict:
    """Hit the Quick Stats API with retry + backoff."""
    for attempt in range(retries):
        try:
            resp = requests.get(API_BASE, params=params, timeout=20)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  Retry {attempt + 1}/{retries} after {wait}s ({exc})")
                time.sleep(wait)
            else:
                raise


def fetch_commodity_month(api_key: str, commodity_key: str, year: int, month: int) -> int | None:
    """Return the cold storage value (in 1000 lb) for one commodity and one month."""
    cfg = COMMODITY_MAP[commodity_key]
    period = PERIOD_NAMES[month - 1]
    params = {
        "key": api_key,
        "format": "JSON",
        "source_desc": "SURVEY",
        "statisticcat_desc": "COLD STORAGE",
        "unit_desc": "1000 LB",
        "freq_desc": "MONTHLY",
        "year": str(year),
        "period_desc": period,
        "short_desc": cfg["short_desc"],
    }
    data = api_get(params)
    records = data.get("data", [])
    if not records:
        return None
    # Take the first (usually only) matching record.
    raw = records[0].get("Value", "")
    try:
        return int(raw.replace(",", ""))
    except ValueError:
        return None


def fetch_month(api_key: str, year: int, month: int, verbose: bool = False) -> dict[str, int]:
    """Fetch all commodities for a given observation month. Returns {key: value_in_1000lb}."""
    result: dict[str, int] = {}
    observation_date = datetime.date(year, month, 1)
    # Last day of the observation month
    if month == 12:
        last_day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        last_day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

    print(f"  Fetching {observation_date.strftime('%B %Y')}...", end=" ", flush=True)
    hits = 0
    for key in COMMODITY_MAP:
        val = fetch_commodity_month(api_key, key, year, month)
        if val is not None:
            result[key] = val
            hits += 1
        time.sleep(0.15)  # be polite to the API

    print(f"{hits}/{len(COMMODITY_MAP)} commodities found")
    return result, str(last_day)


def explore_commodity(api_key: str, commodity_key: str) -> None:
    """Print the raw API response for a commodity to help debug COMMODITY_MAP."""
    cfg = COMMODITY_MAP[commodity_key]
    params = {
        "key": api_key,
        "format": "JSON",
        "source_desc": "SURVEY",
        "statisticcat_desc": "COLD STORAGE",
        "commodity_desc": cfg["commodity_desc"],
        "unit_desc": "1000 LB",
        "freq_desc": "MONTHLY",
        "year": "2026",
        "period_desc": "JAN",
    }
    data = api_get(params)
    records = data.get("data", [])
    if not records:
        print(f"No records found for {commodity_key}")
    else:
        print(f"\n{len(records)} records for '{commodity_key}' (Jan 2026):\n")
        for r in records[:10]:
            print(f"  short_desc: {r.get('short_desc')}")
            print(f"  value:      {r.get('Value')}")
            print()


# ---------------------------------------------------------------------------
# Archive management
# ---------------------------------------------------------------------------
def load_archive() -> dict:
    if ARCHIVE_PATH.exists():
        with open(ARCHIVE_PATH) as f:
            return json.load(f)
    return {
        "meta": {
            "updated": datetime.date.today().isoformat(),
            "source": "USDA NASS Quick Stats API",
            "units": "1000 lb",
            "note": "Commodity values in 1000 lb. Dashboard multiplies by 1000 for display.",
        },
        "snapshots": [],
    }


def save_archive(archive: dict) -> None:
    archive["meta"]["updated"] = datetime.date.today().isoformat()
    ARCHIVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(ARCHIVE_PATH, "w") as f:
        json.dump(archive, f, indent=2)
    size_kb = ARCHIVE_PATH.stat().st_size / 1024
    print(f"Saved {ARCHIVE_PATH} ({size_kb:.1f} KB, {len(archive['snapshots'])} snapshots)")


def find_snapshot(archive: dict, observation_date: str) -> int | None:
    """Return index of existing snapshot or None."""
    for i, s in enumerate(archive["snapshots"]):
        if s["observationDate"] == observation_date:
            return i
    return None


def upsert_snapshot(archive: dict, observation_date: str, commodities: dict[str, int]) -> bool:
    """Add or update a snapshot. Returns True if archive changed."""
    if not commodities:
        return False
    snapshot = {
        "observationDate": observation_date,
        "commodities": commodities,
    }
    idx = find_snapshot(archive, observation_date)
    if idx is not None:
        if archive["snapshots"][idx]["commodities"] == commodities:
            return False
        archive["snapshots"][idx] = snapshot
    else:
        archive["snapshots"].append(snapshot)
        archive["snapshots"].sort(key=lambda s: s["observationDate"])
    return True


# ---------------------------------------------------------------------------
# Month arithmetic
# ---------------------------------------------------------------------------
def months_back(from_date: datetime.date, n: int) -> list[tuple[int, int]]:
    """Return list of (year, month) tuples going n months back from from_date."""
    result = []
    year, month = from_date.year, from_date.month
    for _ in range(n):
        result.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return result


def last_day_of_month(year: int, month: int) -> str:
    if month == 12:
        d = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        d = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    return d.isoformat()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch USDA cold storage data.")
    parser.add_argument("--backfill", type=int, metavar="N", help="Fetch last N months")
    parser.add_argument("--month", metavar="YYYY-MM", help="Fetch a specific month")
    parser.add_argument("--explore", metavar="COMMODITY_KEY", help="Print raw API response for a key")
    args = parser.parse_args()

    api_key = get_api_key()

    if args.explore:
        if args.explore not in COMMODITY_MAP:
            print(f"Unknown key: {args.explore}. Valid keys: {', '.join(COMMODITY_MAP)}")
            sys.exit(1)
        explore_commodity(api_key, args.explore)
        return

    archive = load_archive()
    changed = False

    if args.month:
        year, month = map(int, args.month.split("-"))
        print(f"Fetching {year}-{month:02d}...")
        commodities, obs_date = fetch_month(api_key, year, month)
        if upsert_snapshot(archive, obs_date, commodities):
            changed = True
    elif args.backfill:
        today = datetime.date.today()
        # USDA data lags ~3-4 weeks; start from 2 months ago to be safe.
        start = datetime.date(today.year, today.month, 1) - datetime.timedelta(days=60)
        ym_list = months_back(start, args.backfill)
        print(f"Backfilling {len(ym_list)} months from {ym_list[-1][0]}-{ym_list[-1][1]:02d} to {ym_list[0][0]}-{ym_list[0][1]:02d}...")
        for year, month in reversed(ym_list):
            commodities, obs_date = fetch_month(api_key, year, month)
            if upsert_snapshot(archive, obs_date, commodities):
                changed = True
            time.sleep(0.5)
    else:
        # Default: fetch the month that USDA most recently released.
        today = datetime.date.today()
        # Data for month M is released around the 22nd-24th of M+1.
        if today.day >= 24:
            target = datetime.date(today.year, today.month, 1) - datetime.timedelta(days=1)
        else:
            two_months_ago = datetime.date(today.year, today.month, 1) - datetime.timedelta(days=32)
            target = datetime.date(two_months_ago.year, two_months_ago.month, 1)
        print(f"Fetching latest available month: {target.strftime('%B %Y')}...")
        commodities, obs_date = fetch_month(api_key, target.year, target.month)
        if upsert_snapshot(archive, obs_date, commodities):
            changed = True

    if changed:
        save_archive(archive)
        print("Archive updated.")
    else:
        print("No new data. Archive unchanged.")


if __name__ == "__main__":
    main()
