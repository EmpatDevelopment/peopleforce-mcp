# Using `peopleforce-mcp` with Cursor

## Prerequisites

- **Node.js 18+** and **git**
- A PeopleForce **Company API key**

## 1. Clone and build

```bash
git clone https://github.com/EmpatDevelopment/peopleforce-mcp.git ~/peopleforce-mcp
cd ~/peopleforce-mcp
npm install
npm run build
```

## 2. Add to Cursor

Cursor supports MCP servers via **Settings → MCP → Add new MCP server**, or directly in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "peopleforce": {
      "command": "node",
      "args": ["/absolute/path/to/peopleforce-mcp/dist/index.js"],
      "env": {
        "PEOPLEFORCE_API_KEY": "your_key_here"
      }
    }
  }
}
```

> ⚠️ Use an **absolute path** — Cursor does not expand `~`.

Reload the Cursor MCP panel — the tools appear under the `peopleforce` server with a green status indicator.

## Updating

```bash
cd ~/peopleforce-mcp && git pull && npm install && npm run build
```

Re-open Cursor or disable/re-enable the MCP server from the Settings panel.
