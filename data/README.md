# Data Folder Guide

This folder contains the active app datasets, pipeline sidecars, test fixtures, and versioned raw/release snapshots.

## File Purpose (Current)

- `active-dataset.json`: Pointer to which year is currently active.
- `cities.json`: Active runtime city dataset used by the app (`/api/cities`).
- `realestate.json`: Active runtime normalized graph snapshot.
- `city-coordinates.json`: Manual/fallback city coordinate lookup table.
- `cities.test.json`: Small representative fixture for city dataset testing/reference.
- `properties.test.json`: Small representative fixture for property dataset testing/reference.
- `property-coordinates.test.json`: Small representative fixture for coordinate testing/reference.
- `geocode-cache.test.json`: Small representative fixture for geocode cache testing/reference.
- `raw/`: Versioned raw CSV inputs by year (`raw/2025`, `raw/2026`, ...).
- `releases/`: Versioned generated outputs by year (`releases/2025`, `releases/2026`, ...), including:
	- `releases/<year>/properties.json`
	- `releases/<year>/property-coordinates.json`
	- `releases/<year>/geocode-cache.json`
	- `releases/<year>/cities.json`
	- `releases/<year>/realestate.json`

## Why Keep the `.test.json` Files

Keep them. They are useful as stable, small fixtures for fast regression checks and debugging without running the full pipeline on the full dataset.

## Yearly Update Flow (Simple)

If the new NBIM CSV keeps the same structure/header semantics, one command is enough to import and activate a new year.

Example for any new year:

```bash
npm run dataset:activate -- --year 2027 --source /absolute/path/to/re_20271231.csv
```

If you want stronger geocoding on new addresses, enable Nominatim too:

```bash
npm run dataset:activate -- --year 2027 --source /absolute/path/to/re_20271231.csv --enable-nominatim
```

What this does:

1. Copies the CSV into `data/raw/<year>/`.
2. Builds year-specific outputs into `data/releases/<year>/` (including automatic geocoding).
3. Switches active runtime files in `data/` (`cities.json` and `realestate.json`) to the selected year.
4. Updates `data/active-dataset.json` so normal pipeline runs use the active year by default.

This keeps previous years intact as backup while activating the selected year for the app.

## Geocoding Behavior

Geocoding is automatic in the property pipeline. For each property it tries:

1. Existing cache entries from the active release (`data/releases/<year>/geocode-cache.json`).
2. Photon geocoding API.
3. Optional Nominatim geocoding API (when `--enable-nominatim` is used).
4. Country center fallback from script constants if no match is found.

Manual `city-coordinates.json` is only a fallback lookup for city-level aggregation in the city builder.

## Rebuild Current Active Year

```bash
npm run pipeline
```

`pipeline` now reads from `data/active-dataset.json` (with legacy fallback) so it rebuilds whichever year is active.

`pipeline` writes property-level outputs to the active release folder and refreshes the active runtime snapshots (`cities.json`, `realestate.json`).