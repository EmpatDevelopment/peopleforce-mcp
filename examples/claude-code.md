# Using `peopleforce-mcp` with Claude Code

Claude Code is the official CLI from Anthropic. It stores MCP servers in `~/.claude.json`.

## Prerequisites

- **Node.js 18+** and **git**
- A **PeopleForce Company API key** (PeopleForce → Settings → Open API keys → Generate)

## 1. Clone and build

```bash
git clone https://github.com/EmpatDevelopment/peopleforce-mcp.git ~/peopleforce-mcp
cd ~/peopleforce-mcp
npm install
npm run build
```

## 2. Register the server

```bash
claude mcp add peopleforce --scope user \
  --env PEOPLEFORCE_API_KEY=your_key_here \
  -- node "$HOME/peopleforce-mcp/dist/index.js"
```

Verify:

```bash
claude mcp list
# → peopleforce: node .../peopleforce-mcp/dist/index.js - ✓ Connected
```

## 3. Manual config (alternative to `claude mcp add`)

Edit `~/.claude.json` and add under `mcpServers`:

```json
{
  "peopleforce": {
    "type": "stdio",
    "command": "node",
    "args": ["/absolute/path/to/peopleforce-mcp/dist/index.js"],
    "env": {
      "PEOPLEFORCE_API_KEY": "your_key_here"
    }
  }
}
```

Restart Claude Code.

## Updating

```bash
cd ~/peopleforce-mcp && git pull && npm install && npm run build
```

Restart Claude Code to pick up new tools.

## Sample prompts

- "How many people are currently on probation?"
- "Who is on vacation next week?"
- "List all open vacancies in the Back-end department."
- "Show me the position history of employee 290941."
- "What leave types does the company have?"
