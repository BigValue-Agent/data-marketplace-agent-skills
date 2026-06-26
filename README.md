# Data Marketplace Agent Skills

AI agent skill for building residential real-estate services with the Data Marketplace API.

This skill helps coding agents generate safer Data Marketplace integrations for complex search, map markers, detail panels, building/unit drill-downs, realdeal history, notice prices, and market price views. It is a routing and guardrail layer for API usage, not a replacement for the product API reference.

## Installation

Requires Node.js 18+.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

Use `-g` for global installation:

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills -g
```

For local testing from this repository:

```bash
npx skills add ./ -l
npx skills add ./ -y
```

## Skill

| Skill | Description |
|---|---|
| `data-marketplace-agent-skills` | Data Marketplace residential API guidance for complex search, markers, details, prices, and server-side integration |

## Authentication

Live API calls require a Data Marketplace base URL and API key:

```bash
export DATA_MARKETPLACE_BASE_URL=<your-data-marketplace-url>
export DATA_MARKETPLACE_API_KEY=<your-api-key>
```

The API key must be used server-side in the `X-API-KEY` header. Do not hardcode it or expose it to browser code.

## Usage Notes

- Calls use `POST /api/v1/data-products/{product_id}/call`.
- Filters are sent in the JSON body under `filters`.
- Bbox values are sent as a top-level JSON body `bbox` object.
- Returned rows are read from `result.data`.
- Keep `complex_key`, `pnu`, `ppk`, and `jpk` as strings.
- Read exact `product_id`, supported filters, fields, and response schemas from the API reference provided with your project.

## License

Internal use only. See `LICENSE.md`.
