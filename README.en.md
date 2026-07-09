# Data Marketplace Residential Service Skill

[한국어](README.md) | English

AI code-generator skill for building residential real-estate services with the Data Marketplace API.

This skill helps coding agents compose Data Marketplace residential products for complex search, map markers, detail panels, building/unit drill-downs, realdeal history, notice prices, and estimated price views.

## Installation

Install with Node.js 18+.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

## Skill

| Skill | Description |
|---|---|
| `data-marketplace-residential-service` | Data Marketplace residential service guidance for complex search, markers, detail panels, price tabs, building/unit drill-downs, and server-side integration |

## Usage

After installation, ask your AI code generator for the residential service screen you want to build.

Example:

```text
Build a residential real-estate service with complex search, map markers, a detail panel, and price tabs using Data Marketplace.
```

A full map-service starting template is included under `assets/map-service/`.

## Authentication

Live API calls require a server-side API key and API base URL, both provided at onboarding. This skill supplies product selection and combination rules; per-product filter/field/response snapshots are bundled under `references/api/`, and a newer caller-provided API Reference takes precedence.

```bash
export DATA_MARKETPLACE_API_KEY=<your-api-key>
export DATA_MARKETPLACE_BASE_URL=<data-marketplace-base-url>
```

The API key must be used server-side in the `X-API-KEY` header. Do not hardcode it or expose it to browser code.

## License

Internal use only. See `LICENSE.md`.
