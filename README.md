# US Cold Storage Dashboard

An editorial-style front page for USDA NASS monthly cold storage data. Tracks what the US keeps frozen — butter, cheese, beef, poultry, produce — updated automatically each month when USDA publishes.

## What it is

USDA NASS releases cold storage stock levels for ~150 commodities around the 22nd–24th of each month. This dashboard re-cuts that data as a designed artifact: one dominant poster metric, saturated stat tiles, a 5-year trend chart, and a ranked operations list. Design mode: Editorial Mosaic.

## Stack

Vanilla HTML / CSS / JS. No build tools. No framework. Static site — deploy anywhere.

## Local preview

```bash
python3 -m http.server 4322
# → http://localhost:4322
```

## Data pipeline

The data lives in `data/cold-storage-archive.json` — a rolling archive of monthly USDA snapshots. GitHub Actions updates it automatically on the 25th of each month.

### One-time setup

1. Register a free API key at [quickstats.nass.usda.gov/api](https://quickstats.nass.usda.gov/api)
2. Add as GitHub repository secret: `USDA_API_KEY`
3. (Optional) Add deploy webhook as `DEPLOY_HOOK_URL` and uncomment the deploy step in `.github/workflows/update-data.yml`

### Backfill historical data

```bash
pip install requests
USDA_API_KEY=your_key python scripts/fetch-usda.py --backfill 60
```

Fetches ~5 years of monthly snapshots and writes them to the archive. Run once after initial deploy to populate the 5-year trend chart.

### Manual fetch options

```bash
USDA_API_KEY=your_key python scripts/fetch-usda.py                  # latest month
USDA_API_KEY=your_key python scripts/fetch-usda.py --month 2025-06  # specific month
USDA_API_KEY=your_key python scripts/fetch-usda.py --explore butter  # debug API fields
```

## Files

| File | Role |
|------|------|
| `index.html` | Layout — Front Page Mosaic, 4-row grid |
| `app.js` | Data loading, rendering, sparklines, narrative copy |
| `styles.css` | Editorial Mosaic design system |
| `data/cold-storage-archive.json` | Rolling monthly archive (main data source) |
| `data/cold-storage-feb-2026.json` | Original manual seed — kept for reference |
| `scripts/fetch-usda.py` | USDA Quick Stats ingestion script |
| `.github/workflows/update-data.yml` | Monthly auto-update cron job |
| `CLAUDE.md` | AI context — read before making changes |

## Commodity mapping

If the API returns unexpected fields, verify with:

```bash
USDA_API_KEY=your_key python scripts/fetch-usda.py --explore <key>
```

Valid keys: `butter`, `american_cheese`, `swiss_cheese`, `other_natural_cheese`, `total_natural_cheese`, `total_chicken`, `total_turkey`, `total_frozen_poultry`, `total_frozen_fruit`, `total_frozen_vegetables`, `total_frozen_potatoes`, `total_beef`, `pork_bellies`, `total_pork`, `total_frozen_red_meat`

Update `COMMODITY_MAP` in `scripts/fetch-usda.py` if any `short_desc` strings don't match the API response.

## Data source

USDA NASS Cold Storage survey — [survey guide](https://www.nass.usda.gov/Surveys/Guide_to_NASS_Surveys/Cold_Storage/index.php). Not endorsed or certified by NASS.
