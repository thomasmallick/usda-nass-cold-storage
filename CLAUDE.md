# Cold Storage Dashboard — AI Context

## What this is
An editorial-style dashboard tracking what the US keeps frozen, sourced from USDA NASS monthly cold storage reports. Part of Thomas's personal-site ecosystem — each project is a self-contained deployable with shared design DNA.

## Design mode
**Editorial Mosaic** — kelp / sun / coral / cobalt palette, poster-like hero metric, Front Page Mosaic layout. Read `~/.agents/skills/editorial-dashboard-language/` before making visual decisions.

## Stack
Vanilla HTML / CSS / JS. No build tools. No framework. Static site.

## Key files
| File | Role |
|------|------|
| `index.html` | Layout shell — 4 tabs: Overview / Through Time / Seasons / Deep Cuts, plus detail modal |
| `app.js` | All data logic + rendering. Single `state` object; null-aware sparklines (missing months = gaps, never zero); dynamic editorial headlines; per-American toggle; seasonality math |
| `styles.css` | Full design system; Editorial Mosaic tokens |
| `data/cold-storage-archive.json` | Multi-year monthly archive (main data source) |
| `data/cold-storage-feb-2026.json` | Original manual seed — kept for reference |
| `scripts/fetch-usda.py` | USDA Quick Stats API ingestion (latest / backfill / repair / explore) + snapshot validation |
| `scripts/validate-archive.py` | Standalone archive sanity check (run in CI before commit) |
| `scripts/generate-og.py` | Renders `assets/og-image.png` from latest data (re-run after big data changes) |
| `.github/workflows/update-data.yml` | Monthly cron (25th); validates before commit; opens an issue on failure |

## Front-end invariants
- Headline copy (fast mover / volume leader tiles) is **generated from the data** — never hardcode editorial claims that monthly data can invalidate.
- Missing months render as line gaps; the grand-total trend nulls any month missing a component key. No zeros, no fabricated values.
- Deep-cut commodities can lag the headline month — tiles fall back to last known value with an "as of" tag.
- Aggregates (`total_frozen_poultry`, `total_frozen_red_meat`) must be ≥ the sum of stored components; the validator enforces this (a 2021–2023 partial-backfill bug once stored badly undercounted aggregates).

## Data pipeline
1. USDA releases cold storage data around the 22nd–24th of each month
2. GitHub Actions runs `scripts/fetch-usda.py` on the 25th
3. Script fetches from USDA Quick Stats API → updates `data/cold-storage-archive.json`
4. Git commit pushed → static host auto-redeploys

### Setup required (one-time)
- Register a free USDA Quick Stats API key at `quickstats.nass.usda.gov/api`
- Add it as GitHub Secret `USDA_API_KEY`
- Add deploy webhook URL as GitHub Secret `DEPLOY_HOOK_URL` (uncomment the step in the workflow)

### Backfill historical data
```bash
USDA_API_KEY=your_key python scripts/fetch-usda.py --backfill 60
```

### Repair gaps (fetches only missing month/commodity pairs)
```bash
USDA_API_KEY=your_key python scripts/fetch-usda.py --repair
# USDA rate-limits with HTTP 403 — re-run after a minute if gaps remain
python3 scripts/validate-archive.py   # then confirm health
```

### Debug a commodity mapping
```bash
USDA_API_KEY=your_key python scripts/fetch-usda.py --explore butter
```

## Do Not Re-Litigate
- **No build tools.** Stays vanilla for maximum portability and zero dependencies.
- **No database.** Archive JSON lives in the repo; GitHub is the storage layer.
- **No real-time data.** USDA releases monthly; "live" means latest released snapshot.
- **Editorial Mosaic mode.** Not Field Notes. Don't soften the palette.

## Ecosystem note
This project will be featured as a linked artifact on Thomas's Personal Site (separate project). The through-line is shared design tokens, not shared hosting. Each project deploys independently.

## Local preview
```bash
python3 -m http.server 4323
# → http://localhost:4323
```
