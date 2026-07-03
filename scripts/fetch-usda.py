#!/usr/bin/env python3
"""
Fetch USDA NASS cold storage data and update data/cold-storage-archive.json.

Usage:
  USDA_API_KEY=xxx python scripts/fetch-usda.py              # fetch latest month
  USDA_API_KEY=xxx python scripts/fetch-usda.py --backfill 60
  USDA_API_KEY=xxx python scripts/fetch-usda.py --month 2025-06
  USDA_API_KEY=xxx python scripts/fetch-usda.py --explore BUTTER

Confirmed USDA Quick Stats cold storage schema (verified via get_param_values):
  - statisticcat_desc = STOCKS
  - freq_desc = POINT IN TIME
  - reference_period_desc = END OF JAN (not period_desc=JAN)
  - agg_level_desc = NATIONAL
  - unit_desc = LB (raw pounds — NOT 1000 LB)
  - Archive stores values in 1000 lb — we divide API values by 1000
  - util varies: COLD STORAGE (butter), COLD STORAGE, CHILLED (cheese),
                 COLD STORAGE, FROZEN (meat/produce)
  - short_desc uniquely identifies each row; query by short_desc + year +
    reference_period_desc only (adding redundant fields causes 400 errors)
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

REPO_ROOT = Path(__file__).parent.parent
ARCHIVE_PATH = REPO_ROOT / "data" / "cold-storage-archive.json"
API_BASE = "https://quickstats.nass.usda.gov/api/api_GET/"
PARAM_BASE = "https://quickstats.nass.usda.gov/api/get_param_values/"

# Month number → reference_period_desc value used by USDA cold storage data
MONTH_PERIODS = {
    1: "END OF JAN", 2: "END OF FEB", 3: "END OF MAR",
    4: "END OF APR", 5: "END OF MAY", 6: "END OF JUN",
    7: "END OF JUL", 8: "END OF AUG", 9: "END OF SEP",
    10: "END OF OCT", 11: "END OF NOV", 12: "END OF DEC",
}

# ---------------------------------------------------------------------------
# Commodity map
#
# "short_desc" entries → single API query; one record expected.
# "aggregate_of" entries → fetch each component and sum them.
#
# All short_desc strings were confirmed via direct API calls (Jan 2026).
# Values arrive in LB; the archive stores 1000-lb units (divide by 1000).
# ---------------------------------------------------------------------------
COMMODITY_MAP: dict[str, dict] = {
    "butter": {
        "short_desc": "BUTTER, COLD STORAGE - STOCKS, MEASURED IN LB",
    },
    "american_cheese": {
        "short_desc": "CHEESE, NATURAL, AMERICAN, COLD STORAGE, CHILLED - STOCKS, MEASURED IN LB",
    },
    "swiss_cheese": {
        "short_desc": "CHEESE, NATURAL, SWISS, COLD STORAGE, CHILLED - STOCKS, MEASURED IN LB",
    },
    "other_natural_cheese": {
        "short_desc": "CHEESE, NATURAL, (EXCL AMERICAN & SWISS), COLD STORAGE, CHILLED - STOCKS, MEASURED IN LB",
    },
    "total_natural_cheese": {
        "short_desc": "CHEESE, NATURAL, COLD STORAGE, CHILLED - STOCKS, MEASURED IN LB",
    },
    "total_chicken": {
        "short_desc": "CHICKENS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "total_turkey": {
        "short_desc": "TURKEYS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    # total_frozen_poultry: no USDA total exists; sum sub-commodities.
    # Ducks are a small contributor but USDA publishes them separately.
    "total_frozen_poultry": {
        "aggregate_of": [
            "CHICKENS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
            "TURKEYS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
            "DUCKS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
        ],
    },
    "total_frozen_fruit": {
        "short_desc": "FRUIT TOTALS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "total_frozen_vegetables": {
        "short_desc": "VEGETABLE TOTALS, (EXCL POTATOES), COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "total_frozen_potatoes": {
        "short_desc": "POTATOES, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "total_beef": {
        "short_desc": "BEEF, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "pork_bellies": {
        "short_desc": "PORK, BELLIES, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "total_pork": {
        "short_desc": "PORK, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    # total_frozen_red_meat: no USDA total; sum sub-commodities.
    "total_frozen_red_meat": {
        "aggregate_of": [
            "BEEF, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
            "PORK, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
            "VEAL, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
            "LAMB & MUTTON, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
        ],
    },

    # -------------------------------------------------------------------------
    # Deep-cut commodities — granular breakdowns shown in the Deep Cuts view.
    # All short_desc values confirmed via --explore (Jan 2026).
    # -------------------------------------------------------------------------

    # Pork cuts
    "pork_hams": {
        "short_desc": "PORK, HAMS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "pork_ribs": {
        "short_desc": "PORK, RIBS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "pork_loins": {
        "short_desc": "PORK, LOINS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "pork_butts": {
        "short_desc": "PORK, BUTTS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "pork_trimmings": {
        "short_desc": "PORK, TRIMMINGS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },

    # Beef cuts
    "beef_boneless": {
        "short_desc": "BEEF, BONELESS, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "beef_bone_in": {
        "short_desc": "BEEF, BONE-IN, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },

    # Frozen fruits
    "strawberries": {
        "short_desc": "STRAWBERRIES, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "blueberries": {
        "short_desc": "BLUEBERRIES, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "raspberries": {
        "short_desc": "RASPBERRIES, RED, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "cherries_tart": {
        "short_desc": "CHERRIES, TART, COLD STORAGE, RTP, FROZEN - STOCKS, MEASURED IN LB",
    },

    # Frozen vegetables
    "sweet_corn_cut": {
        "short_desc": "SWEET CORN, CUT, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "sweet_corn_cob": {
        "short_desc": "SWEET CORN, COB, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "beans_green": {
        "short_desc": "BEANS, GREEN, REGULAR CUT, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "carrots": {
        "short_desc": "CARROTS, (EXCL DICED), COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "peas_green": {
        "short_desc": "PEAS, GREEN, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "spinach": {
        "short_desc": "SPINACH, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
    "broccoli": {
        "short_desc": "BROCCOLI, CHOPPED & CUT, COLD STORAGE, FROZEN - STOCKS, MEASURED IN LB",
    },
}


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
_API_KEY = ""


def get_api_key() -> str:
    global _API_KEY
    key = os.environ.get("USDA_API_KEY", "").strip()
    if not key:
        print("ERROR: USDA_API_KEY environment variable not set.", file=sys.stderr)
        print("  Register free at: https://quickstats.nass.usda.gov/api", file=sys.stderr)
        sys.exit(1)
    _API_KEY = key
    return key


def redact(text: object) -> str:
    """Strip the API key from any string before it reaches logs.

    requests exception messages embed the full request URL, which carries
    the key as a query parameter."""
    s = str(text)
    return s.replace(_API_KEY, "***") if _API_KEY else s


def api_get(params: dict, retries: int = 4) -> dict:
    """Hit the Quick Stats API with retry + backoff.
    4xx = bad query, raise immediately. 5xx = server/rate-limit, retry with backoff."""
    for attempt in range(retries):
        try:
            resp = requests.get(API_BASE, params=params, timeout=30)
            if 400 <= resp.status_code < 500:
                resp.raise_for_status()  # bad query — don't retry
            if resp.status_code >= 500:
                raise requests.exceptions.HTTPError(
                    f"HTTP {resp.status_code}", response=resp
                )
            return resp.json()
        except requests.exceptions.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else 0
            if code >= 500 and attempt < retries - 1:
                wait = 2 ** (attempt + 1)  # 2, 4, 8 s
                print(f"  [{code}] Retry {attempt + 1}/{retries - 1} after {wait}s")
                time.sleep(wait)
            else:
                raise
        except requests.RequestException as exc:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  Retry {attempt + 1}/{retries - 1} after {wait}s ({redact(exc)})")
                time.sleep(wait)
            else:
                raise


def fetch_short_desc(api_key: str, short_desc: str, year: int, month: int) -> int | None:
    """Fetch a single short_desc value for a given year/month. Returns lb value or None."""
    ref_period = MONTH_PERIODS[month]
    params = {
        "key": api_key,
        "format": "JSON",
        "short_desc": short_desc,
        "year": str(year),
        "reference_period_desc": ref_period,
        "agg_level_desc": "NATIONAL",
    }
    try:
        data = api_get(params)
    except requests.exceptions.HTTPError as exc:
        print(f"\n    WARN [{short_desc[:50]}] {year}-{month:02d}: HTTP {exc.response.status_code}")
        return None
    except requests.RequestException as exc:
        print(f"\n    WARN [{short_desc[:50]}] {year}-{month:02d}: network error ({redact(exc)})")
        return None

    records = data.get("data", [])
    if not records:
        return None

    # If multiple records returned (unexpected), take "ALL CLASSES" or first.
    if len(records) > 1:
        all_class = [r for r in records if r.get("class_desc") == "ALL CLASSES"]
        record = all_class[0] if all_class else records[0]
        print(f"\n    NOTE [{short_desc[:50]}]: {len(records)} records, used class={record.get('class_desc')!r}")
    else:
        record = records[0]

    raw = record.get("Value", "")
    try:
        return int(raw.replace(",", ""))
    except ValueError:
        return None


def fetch_commodity_month(api_key: str, key: str, year: int, month: int) -> int | None:
    """Return cold storage value in 1000 lb for one archive key and one month."""
    cfg = COMMODITY_MAP[key]

    if "short_desc" in cfg:
        lb = fetch_short_desc(api_key, cfg["short_desc"], year, month)
        if lb is None:
            return None
        return lb // 1000

    if "aggregate_of" in cfg:
        total = 0
        found = 0
        for short_desc in cfg["aggregate_of"]:
            lb = fetch_short_desc(api_key, short_desc, year, month)
            if lb is not None:
                total += lb
                found += 1
            time.sleep(0.5)
        if found == 0:
            return None
        if found < len(cfg["aggregate_of"]):
            print(f"\n    NOTE [{key}]: only {found}/{len(cfg['aggregate_of'])} components found")
        return total // 1000

    raise ValueError(f"COMMODITY_MAP[{key!r}] must have 'short_desc' or 'aggregate_of'")


def fetch_month(api_key: str, year: int, month: int) -> tuple[dict[str, int], str]:
    """Fetch all commodities for one month. Returns ({key: value_1000lb}, observation_date)."""
    result: dict[str, int] = {}
    last_day = last_day_of_month(year, month)

    print(f"  Fetching {MONTH_PERIODS[month].replace('END OF ', '')} {year}...", end=" ", flush=True)
    hits = 0
    for key in COMMODITY_MAP:
        val = fetch_commodity_month(api_key, key, year, month)
        if val is not None:
            result[key] = val
            hits += 1
        time.sleep(0.5)  # stay under USDA rate limit

    print(f"{hits}/{len(COMMODITY_MAP)} found")
    return result, last_day


def explore_commodity(api_key: str, commodity_desc: str) -> None:
    """Print all STOCKS records for a commodity to help identify correct short_desc."""
    params = {
        "key": api_key,
        "format": "JSON",
        "commodity_desc": commodity_desc.upper(),
        "statisticcat_desc": "STOCKS",
        "agg_level_desc": "NATIONAL",
        "year": "2026",
        "reference_period_desc": "END OF JAN",
    }
    try:
        data = api_get(params)
    except requests.exceptions.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else "?"
        body = exc.response.text[:300] if exc.response is not None else ""
        print(f"HTTP {code}: {redact(body)}")
        return
    except requests.RequestException as exc:
        print(f"Network error: {redact(exc)}")
        return

    records = data.get("data", [])
    if not records:
        print(f"No STOCKS records found for commodity_desc={commodity_desc!r} (Jan 2026 national)")
        return

    print(f"\n{len(records)} records for {commodity_desc!r} — Jan 2026:\n")
    for r in records[:20]:
        print(f"  short_desc:        {r.get('short_desc')!r}")
        print(f"  class_desc:        {r.get('class_desc')!r}")
        print(f"  util_practice:     {r.get('util_practice_desc')!r}")
        print(f"  value (LB):        {r.get('Value')}")
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


def find_snapshot_idx(archive: dict, observation_date: str) -> int | None:
    for i, s in enumerate(archive["snapshots"]):
        if s["observationDate"] == observation_date:
            return i
    return None


def upsert_snapshot(archive: dict, observation_date: str, commodities: dict) -> bool:
    if not commodities:
        return False
    snapshot = {"observationDate": observation_date, "commodities": commodities}
    idx = find_snapshot_idx(archive, observation_date)
    if idx is not None:
        if archive["snapshots"][idx]["commodities"] == commodities:
            return False
        archive["snapshots"][idx] = snapshot
    else:
        archive["snapshots"].append(snapshot)
        archive["snapshots"].sort(key=lambda s: s["observationDate"])
    return True


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------
def last_day_of_month(year: int, month: int) -> str:
    if month == 12:
        d = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        d = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    return d.isoformat()


def months_back(from_date: datetime.date, n: int) -> list[tuple[int, int]]:
    result = []
    year, month = from_date.year, from_date.month
    for _ in range(n):
        result.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch USDA cold storage data.")
    parser.add_argument("--backfill", type=int, metavar="N", help="Fetch last N months")
    parser.add_argument("--month", metavar="YYYY-MM", help="Fetch a specific month")
    parser.add_argument(
        "--explore", metavar="COMMODITY_DESC",
        help="Print all STOCKS records for a commodity name (e.g. BUTTER, CHICKENS)",
    )
    args = parser.parse_args()

    api_key = get_api_key()

    if args.explore:
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
        # USDA data for month M releases ~22nd-24th of M+1; start 2 months back.
        start = datetime.date(today.year, today.month, 1) - datetime.timedelta(days=60)
        ym_list = months_back(start, args.backfill)
        print(
            f"Backfilling {len(ym_list)} months "
            f"({ym_list[-1][0]}-{ym_list[-1][1]:02d} → {ym_list[0][0]}-{ym_list[0][1]:02d})..."
        )
        for year, month in reversed(ym_list):
            commodities, obs_date = fetch_month(api_key, year, month)
            if upsert_snapshot(archive, obs_date, commodities):
                changed = True
                save_archive(archive)  # save incrementally so a kill doesn't lose everything
            time.sleep(3.0)  # pause between months to avoid rate limiting

    else:
        # Default: the most recently published month (USDA releases ~22nd-24th of M+1).
        today = datetime.date.today()
        if today.day >= 24:
            prev = datetime.date(today.year, today.month, 1) - datetime.timedelta(days=1)
            target_year, target_month = prev.year, prev.month
        else:
            two_back = datetime.date(today.year, today.month, 1) - datetime.timedelta(days=32)
            target_year, target_month = two_back.year, two_back.month
        print(f"Fetching latest available: {MONTH_PERIODS[target_month]} {target_year}...")
        commodities, obs_date = fetch_month(api_key, target_year, target_month)
        if upsert_snapshot(archive, obs_date, commodities):
            changed = True

    if changed:
        save_archive(archive)
        print("Archive updated.")
    else:
        print("No new data. Archive unchanged.")


if __name__ == "__main__":
    main()
