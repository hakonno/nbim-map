# NBIM Investment Map

Interactive map of NBIM real estate investments, with city-level and property-level views.

## Tech

- Next.js 16
- React 19
- TypeScript
- Leaflet + react-leaflet
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
