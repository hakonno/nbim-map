# NBIM Investment Map

Interactive map of NBIM real estate investments, with city-level and property-level views.

## Tech

- Next.js 16
- React 19
- TypeScript
- MapLibre GL
- Playwright

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run dataset:activate -- --year 2026 --source /path/to/re_20261231.csv
npm run pipeline
npm run pipeline:properties
npm run pipeline:cities
```

## Base Map

The map is MapLibre GL over an ordered chain of interchangeable basemap
providers (`components/map/gl/basemapProviders.ts`). Every tier renders through
the same engine, so clustering, callouts, hover labels, tilt and camera framing
behave identically on all of them:

| Tier | Provider | Key | 3D buildings |
| --- | --- | --- | --- |
| 1 | MapTiler `streets-v2` | `MAPTILER_API_KEY` | yes |
| 2 | [OpenFreeMap](https://openfreemap.org) Liberty (vector) | none | yes |
| 3 | OpenStreetMap raster tiles | none | no (raster has no building geometry) |

The map opens on the first tier it can use and drops to the next one by itself
when a style or tile request comes back 401/402/403/429 (rejected key, spent
credits), fails outright, or never arrives. The swap happens in place — same map
instance, same camera, markers re-added onto the new style — so a reader mid-session
only sees the basemap art change. Only a browser without WebGL, or every tier
failing, falls back to the list-only view.

Set `MAP_PROVIDER=openfreemap` (or `osm`) to pin a keyless tier without touching
the key, and `MAPTILER_API_KEY` is optional: leave it blank and tier 2 leads.
The container element carries `data-basemap="<tier id>"` so the tier in use is
visible in devtools.

## Data Pipeline

The pipeline reads raw CSV input from `data/raw/<year>/` (based on `data/active-dataset.json`) and generates:

- `data/releases/<active-year>/properties.json`
- `data/releases/<active-year>/property-coordinates.json`
- `data/releases/<active-year>/geocode-cache.json`
- `data/releases/<active-year>/cities.json`
- `data/releases/<active-year>/realestate.json` (normalized graph: countries -> cities -> properties)

For runtime convenience, active snapshots are mirrored to:

- `data/cities.json`
- `data/realestate.json`

`data/realestate.json` is optimized for ID-based lookups and deduplicated country-level values. It includes dictionaries for repeated property strings (`partnerships`, `sectors`) and references those values by numeric IDs.

For a simple file-by-file data overview and yearly update flow, see `data/README.md`.

## Deployment

Deploy directly on Vercel by importing this repository.

## Data Disclaimer

This is an independent project using publicly available data. It is not affiliated with Norges Bank Investment Management (NBIM). Data may be inaccurate.

Source: [NBIM holdings data (31 Dec 2025)](https://www.nbim.no/en/investments/all-investments/#/2025-12-31/2-real_estate)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
