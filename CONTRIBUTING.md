# Contributing to NBIM Map

We appreciate your interest in contributing! Here's how you can help:

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/nbim-map.git`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Install dependencies: `npm install`

## Development

- Run dev server: `npm run dev`
- Run linter: `npm run lint`
- Run tests: `npm run test` (if tests are added)
- Run data pipeline: `npm run pipeline` (requires raw data CSV)

## Code Style

- We use ESLint and TypeScript strict mode
- Format code with consistent indentation (already configured)
- Write descriptive commit messages

## Submitting Changes

1. Push to your fork
2. Create a Pull Request with a clear description
3. Link any related GitHub issues
4. Wait for review and address feedback

## Reporting Issues

Please create an issue with:
- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (OS, Node version, etc.)

## Data

If you're adding new data or modifying the pipeline:
- Document changes to `scripts/pipeline.mjs`
- Test with sample data
- Ensure coordinates are accurate

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
