# BigValue Real Estate (빅밸류 부동산)

[한국어](README.md) | English

BigValue Real Estate is an AI agent plugin for working with residential property data from BigValue Data Marketplace. It supports complex discovery, residential data analysis and comparison, and service development for apartments, officetels, and low-rise multifamily housing in Korea.

The plugin includes skills that describe task workflows and an MCP (Model Context Protocol) connection for data access. MCP is a standard protocol for connecting AI tools to external data. Once installation and authentication are complete, you can request tasks in the chat.

## Available skills

| Skill | Main features | Documentation |
| --- | --- | --- |
| Residential Complex Finder | Finds complexes by criteria such as location, number of households, floor area, and price. Distinguishes verified criteria from items that need further checking. | [residential-complex-finder](skills/residential-complex-finder/SKILL.md) |
| Residential Diagnostic Report | Analyzes transactions, prices, location, and housing composition for a complex or area, highlighting key findings and caveats. | [residential-diagnostic-report](skills/residential-diagnostic-report/SKILL.md) |
| Residential Comparison Report | Compares two or more complexes, areas, or other targets using consistent criteria. Provides rankings or priorities on request. | [residential-comparison-report](skills/residential-comparison-report/SKILL.md) |
| Residential Service Development | Supports data integration and code generation for services with complex search, maps, and complex, building, and unit details. | [data-marketplace-residential-service](skills/data-marketplace-residential-service/SKILL.md) |

The plugin also includes a [setup skill](skills/setup/SKILL.md) for checking the connection after installation.

## Installation and authentication

Choose the installation method for your tool. Do not install both the plugin and individual skills in the same tool.

Data access requires an account with permission to use BigValue data. The plugin's MCP connection authenticates through browser sign-in (OAuth); you do not need to enter an API key. If your account does not have access, contact your onboarding representative for approval.

### Claude Code

In a version of Claude Code that supports plugins, enter the following commands in the chat:

```text
/plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
/plugin install bigvalue-realestate@bigvalue-agent-skills
```

Follow the installation prompts to select the installation scope. If the plugin needs to be reloaded, run:

```text
/reload-plugins
```

The plugin registers its bundled MCP server automatically. In `/mcp`, select `bigvalue-realestate` and complete sign-in in your browser. After signing in, start a new session and check the connection with:

```text
/bigvalue-realestate:setup
```

### Codex CLI

You need a version of Codex CLI that supports `codex plugin`. In a terminal, register the marketplace and install the plugin:

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
codex plugin add bigvalue-realestate@bigvalue-agent-skills
```

The plugin registers its bundled MCP server automatically. Run the following command yourself and complete sign-in in your browser:

```bash
codex mcp login bigvalue-realestate
```

After installation and authentication, restart Codex and check the registered MCP servers in a terminal:

```bash
codex mcp list --json
```

Then enter one of the usage examples below in a new chat to confirm that data can be retrieved.

### ChatGPT desktop

You can use the plugin in a ChatGPT desktop app that supports local marketplaces. With Codex CLI installed, register this repository from a terminal:

```bash
codex plugin marketplace add BigValue-Agent/data-marketplace-agent-skills
```

Restart the app, then select the registered marketplace in the Plugins Directory in Work mode or Codex. Install `빅밸류 부동산 (BigValue Real Estate)` and complete sign-in in your browser.

Local marketplaces are separate from the public plugin directory. Available menus and administrative policies may vary by environment. See the [OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins) for details.

### Skills-only installation

For other AI tools that support skill installation, use the following command. Node.js and npm are required.

```bash
npx skills add BigValue-Agent/data-marketplace-agent-skills
```

Follow the prompts to select your tool and the skills to install. This does not configure MCP. To access data, set up the connection separately using the [BigValue AI connection guide](https://datamarket.bigvalue.ai/ai#platforms).

The same guide covers connecting data access alone in tools such as ChatGPT. Connecting MCP alone does not install the skills in this repository.

### Checking the connection

If the connection still fails after authentication, try again in a new session. If you installed the plugin, do not register another MCP server with the same name; follow the [connection check instructions](skills/setup/SKILL.md). For a skills-only installation, review the settings for your tool in the [BigValue AI connection guide](https://datamarket.bigvalue.ai/ai#platforms).

## Usage examples

After installation and authentication, enter a request in the chat, such as one of the examples below.

Discovery, analysis, and comparison results are provided in Markdown by default. You can also request an HTML report. No file upload or map API key is required for these tasks.

### Find complexes by criteria

```text
Find apartment complexes in Mapo-gu where units with 84 m² of exclusive-use floor area
have recently sold for KRW 1.2 billion or less. I'd prefer somewhere near a subway station.
```

Results include information relevant to your criteria, such as transaction prices and distances to stations. Items that could not be verified are marked separately.

This searches for candidate complexes, not currently available listings or asking prices.

### Analyze a residential market

```text
How active is the apartment market in Jamsil-dong these days?
Summarize recent transaction prices and transaction volume.
```

The report summarizes transaction price ranges and volume for the period covered, with caveats for interpreting the data.

### Compare residential properties

```text
I'm considering moving to either Ricenz or Helio City.
Compare prices, transport access, and nearby amenities.
```

Results compare prices, transport access, and nearby amenities by category. If you request a ranking, the evaluation criteria are included.

### Build a residential service

```text
Build a web service where I can find apartment complexes on a map in an area I'm interested in
and click a complex to view its recent transactions.
```

The skill connects the required data and generates service code. The map-service template is reference code for development, not a finished application ready for deployment. Adapt it to your requirements; see the [map-service template guide](skills/data-marketplace-residential-service/assets/map-service/README.md) for its structure and setup instructions.

## Service development setup

If the generated service calls the BigValue REST API directly, it needs an API key separate from MCP sign-in. Set the key as a server environment variable:

```bash
export DATA_MARKETPLACE_API_KEY="your_api_key"
```

The default API base URL is `https://datamarket-api.bigvalue.ai`. Send the API key from the server in the `X-API-KEY` header; do not include it in browser code or commit it to the repository. A map SDK may require a separate provider key and domain configuration.

## Related documentation

- [BigValue AI connection guide](https://datamarket.bigvalue.ai/ai): Data connection and authentication instructions for each tool
- [Data product documentation index](https://datamarket.bigvalue.ai/llms.txt): Current product-specific filters, fields, and response documentation
- [Plugin connection check](skills/setup/SKILL.md): Installation and MCP authentication checks
- [Map-service template](skills/data-marketplace-residential-service/assets/map-service/README.md): Service structure and setup instructions

## License

This repository is for internal use only. Redistribution or public publication requires separate approval from BigValue. See [LICENSE.md](LICENSE.md) for details.
