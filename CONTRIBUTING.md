# Contributing

Thanks for your interest in improving `peopleforce-mcp`. This project is maintained by [Empat](https://www.empat.tech), a Ukrainian software development company, and is offered to the community under the MIT license.

## Quick Start

```bash
git clone https://github.com/EmpatDevelopment/peopleforce-mcp.git
cd peopleforce-mcp
npm install
npm test          # runs type check + unit + stdio smoke tests
npm run build
```

## Project Layout

```
src/
  client.ts       # HTTP client for PeopleForce v3 API (fetch-based, no deps beyond the MCP SDK)
  index.ts       # MCP server: tool manifest + handlers + stdio transport
test/
  client.test.ts  # unit tests (mocked fetch)
  server.test.ts  # stdio smoke test (spawns the compiled server)
examples/         # ready-to-paste MCP client config snippets
```

## Adding a New Tool

1. Confirm the endpoint is reachable by probing it with `curl`:

   ```bash
   curl -H "X-API-KEY: $PEOPLEFORCE_API_KEY" https://app.peopleforce.io/api/public/v3/<new-endpoint>?per_page=1
   ```

2. For plain list endpoints, add a single line in `src/index.ts`:

   ```ts
   paginated("your_endpoint", "One-line human-readable description."),
   ```

3. For endpoints that need filters or path parameters, follow the pattern used by `peopleforce_list_leave_requests` or `peopleforce_list_employee_positions` — explicit `tool` / `schema` / `handler`.

4. Add the new tool name to the assertion list in `test/server.test.ts`.

5. Update `CHANGELOG.md` under the `## [Unreleased]` section.

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add list_performance_reviews tool`
- `fix: handle 429 rate-limit responses`
- `docs: clarify API key scope`
- `test: cover pagination edge case`

## Release Process (Maintainers)

The project is distributed from GitHub — we do not publish to npm.

1. Bump the version in `package.json`.
2. Move `## [Unreleased]` notes into a dated section in `CHANGELOG.md`.
3. `npm run typecheck && npm run test && npm run build`.
4. Commit, then `git tag v<x.y.z>` and `git push --tags`.
5. Create a GitHub Release pointing at the new tag (paste the CHANGELOG section as release notes). This is what downstream users subscribe to.
