# @empat/peopleforce-mcp

[![CI](https://github.com/EmpatDevelopment/peopleforce-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/EmpatDevelopment/peopleforce-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@empat/peopleforce-mcp.svg)](https://www.npmjs.com/package/@empat/peopleforce-mcp)
[![license](https://img.shields.io/npm/l/@empat/peopleforce-mcp.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/@empat/peopleforce-mcp.svg)](https://nodejs.org)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that connects **Claude**, **Cursor**, **Claude Desktop**, and any MCP-compatible LLM client to the **[PeopleForce](https://peopleforce.io)** HRIS / ATS.

27 read-only tools cover the PeopleForce v3 REST API — employees, time-off, recruitment, and all reference data — so your AI assistant can answer HR questions grounded in live company data without bouncing you back to the web app.

> Built and maintained by [**Empat**](https://www.empat.tech) — a Ukrainian custom software development company. We ship this connector as open source to make AI-assisted HR automation a commodity for every PeopleForce customer.

---

## Why this exists

PeopleForce is one of the fastest-growing HRIS platforms in Eastern Europe, but as of 2026 it has **no official MCP connector**. That means Claude, Cursor, and other LLM agents can't answer questions like:

- "Who is on vacation next week in the Back-end department?"
- "How many people are currently on probation?"
- "List all open Senior iOS vacancies we haven't filled for 30+ days."
- "What leave balance does `ir@empat.tech` have left this quarter?"

`@empat/peopleforce-mcp` fixes that. It is a minimal, read-only, fetch-based TypeScript server that ships as an npm package and plugs into any MCP client in one command.

## Features

- ✅ **27 tools** across employees, time-off, recruitment, tasks, assets, and reference data.
- ✅ **Read-only by design** — the 0.x line never mutates your PeopleForce data.
- ✅ **Zero-install via `npx`** — `npx -y @empat/peopleforce-mcp` just works.
- ✅ **Actionable errors** — 401 tells you to check your key, 404 tells you the endpoint isn't on v3.
- ✅ **Built-in pagination** plus a `find_employee_by_email` workflow tool that paginates for you.
- ✅ **Escape hatch** — `api_request` lets your agent hit any v3 GET endpoint not yet modelled.
- ✅ **Node.js 18 / 20 / 22** — covered by CI.
- ✅ **Typed end-to-end**, smoke-tested over stdio.

## Quick start

### 1 — Create a PeopleForce API key

PeopleForce → **Settings → Open API keys** → Generate.

Pick the **Company API key** (full read access to employee data). Optionally restrict it to your IP range on the PeopleForce allow-list.

### 2 — Install for your MCP client

**Claude Code**

```bash
claude mcp add peopleforce --scope user \
  --env PEOPLEFORCE_API_KEY=your_key_here \
  -- npx -y @empat/peopleforce-mcp
```

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "peopleforce": {
      "command": "npx",
      "args": ["-y", "@empat/peopleforce-mcp"],
      "env": { "PEOPLEFORCE_API_KEY": "your_key_here" }
    }
  }
}
```

**Cursor** — paste the same JSON into `~/.cursor/mcp.json` under `mcpServers`.

Detailed guides in [`examples/`](./examples).

### 3 — Ask something

> _"How many people are on probation right now, and which departments are they in?"_

The model will call `peopleforce_list_employees` with `status=probation`, paginate through the results, and summarise.

## Tool reference

Every tool is prefixed with `peopleforce_` and is **read-only**. All list tools accept `page` (≥ 1) and `per_page` (≤ 100).

### Employees

| Tool | Purpose |
|------|---------|
| `list_employees` | Paginated roster; filter by `status` (employed / probation / dismissed / …). |
| `get_employee` | Full profile by numeric `id`. |
| `find_employee_by_email` | Looks up an employee by work or personal email; paginates internally. |
| `list_employee_positions` | Position / role history for one employee. |
| `list_employee_documents` | Documents attached to one employee. |
| `list_employee_assets` | Assets assigned to one employee. |

### Time-off & calendar

| Tool | Purpose |
|------|---------|
| `list_leave_requests` | Filter by `employee_id`, `state` (pending / approved / rejected / cancelled), `leave_type_id`. |
| `list_leave_types` | Vacation, sick, optional holiday, etc. |
| `list_holidays` | Official company holidays. |

### Recruitment / ATS

| Tool | Purpose |
|------|---------|
| `list_recruitment_vacancies` | Open & closed jobs. |
| `list_recruitment_candidates` | Candidates in the pipeline. |
| `list_recruitment_pipelines` | Pipelines and their stages. |
| `list_recruitment_sources` | Where candidates came from. |

### Reference data

`list_departments`, `list_positions`, `list_locations`, `list_divisions`, `list_teams`, `list_job_levels`, `list_job_profiles`, `list_legal_entities`, `list_employment_types`, `list_genders`, `list_skills`, `list_competencies`, `list_assets`, `list_tasks`.

### Escape hatch

`api_request` — raw GET against any `/api/public/v3/<path>` with an optional `query` object. Use it when the endpoint you need isn't modelled above, and consider opening a PR to promote it to a first-class tool.

## Security

This server requires a PeopleForce Company API key, which is effectively read access to your entire employee database. Read [`SECURITY.md`](./SECURITY.md) for full guidance — tl;dr:

- Store it only in `PEOPLEFORCE_API_KEY` (env var or your MCP client's encrypted config).
- Never commit it; never paste it into chat, Slack, or Notion.
- Rotate immediately if leaked (PeopleForce → Settings → Open API keys → Revoke + Generate).
- Restrict to allow-listed IPs where your MCP client runs.

## Development

```bash
git clone https://github.com/EmpatDevelopment/peopleforce-mcp.git
cd peopleforce-mcp
npm install
npm test           # unit + stdio smoke tests (no PeopleForce account required)
npm run build
PEOPLEFORCE_API_KEY=xxx node dist/index.js   # run locally
```

Full contribution guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## FAQ

**Does it write to PeopleForce?** No. 0.x is read-only by design. Mutating tools would be opt-in via a future feature flag.

**Does it store my data anywhere?** No. The server is a stateless stdio proxy between your MCP client and the PeopleForce API. Requests never leave the process.

**Is it rate-limited?** PeopleForce rate-limits the API itself. The server surfaces any 429 responses as actionable errors; it does not retry automatically.

**Which PeopleForce plans are supported?** Any plan that exposes the v3 API. The Career key has a narrower scope (vacancies only) and will 404 on most tools — use a Company key.

**Can I self-host it?** Yes — it's pure Node.js 18+. Run `node dist/index.js` inside any container with the env var set.

## About Empat

[**Empat**](https://www.empat.tech) is a product-focused **custom software development company** based in Lviv, Ukraine. Since 2013 we have delivered 300+ projects across 23 markets — including **fintech software development**, **AI software development**, **SaaS development**, and **custom mobile app development** for Y Combinator alumni, Fortune 500 companies, and 19 Forbes 30 Under 30 founders.

Ways we work with clients:

- Full **product development** — Discovery, PoC, MVP, launch, growth.
- **CTO as a service** for early-stage founders.
- **Dedicated developer hiring** and **IT staff augmentation** (iOS, Android, Flutter, React Native, Node.js, Python, .NET, QA, DevOps, Design).
- **Product validation and consulting**.

Industries we serve: healthcare (remote monitoring, tele-consultations), **fintech** (payments, banking, commissions), social networks, education, entertainment & gaming, e-commerce.

5.0 on Clutch · Top 100 Fastest Growth 2026 · 300+ delivered products · $380M raised by clients in 2023.

👉 **[empat.tech](https://www.empat.tech)** — tell us what you're building.

## License

[MIT](./LICENSE) © 2026 Empat.
