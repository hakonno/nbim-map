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
npm run pipeline
npm run pipeline:properties
npm run pipeline:cities
```

## Data Pipeline

The pipeline reads raw CSV input from `data/raw/` and generates:

- `data/properties.json`
- `data/property-coordinates.json`
- `data/cities.json`
- `data/geocode-cache.json`

## Deployment

Deploy directly on Vercel by importing this repository.

## Data Disclaimer

This is an independent project using publicly available data. It is not affiliated with Norges Bank Investment Management (NBIM). Data may be inaccurate.

Source: [NBIM holdings data (31 Dec 2025)](https://www.nbim.no/en/investments/all-investments/#/2025-12-31/2-real_estate)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
