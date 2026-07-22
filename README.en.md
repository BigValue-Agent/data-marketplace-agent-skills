# Data Marketplace Residential Service Skill

[한국어](README.md) | English

AI code-generator skill for building residential real-estate services with the Data Marketplace API.

This skill helps coding agents compose Data Marketplace residential products for complex search, map markers, detail panels, building/unit drill-downs, realdeal history, notice prices, and estimated price views.

## Installation

Pick **one** method per tool. Combining methods loads the same skill twice.

### Option A — Claude Code plugin (recommended: skill + MCP tools + key setup in one step)

Run these commands in Claude Code, in order:

```text
/plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
/plugin install bigvalue-realestate@bigvalue-agent-skills
/reload-plugins
/bigvalue-realestate:setup
```

During installation you will be prompted for the **MCP server URL** and **API key** provided at onboarding.
The API key is kept in secure storage (OS keychain) and is only sent as the MCP server auth header.
After `/reload-plugins`, both the skill and the Data Marketplace MCP tools (product contracts, recipes, templates, live queries) are active.
The final `/bigvalue-realestate:setup` verifies the MCP connection actually works and guides configuration if it does not.

### Option A-2 — Codex / ChatGPT desktop plugin (skill + manual MCP connection)

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
```

Then install `BigValue Real Estate` from the Plugins Directory in the ChatGPT desktop app (Work mode or Codex).
This plugin bundles the skill; the MCP connection is guided by the `setup` skill — run `setup` after install to register the API key safely via the environment-variable-name method.

### Option B — skill only (npx, for tools without plugin support)

Use this only on tools that do not support plugins. Install with Node.js 18+.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

If you need the MCP connection, follow the per-tool registration steps from your onboarding guide.

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
