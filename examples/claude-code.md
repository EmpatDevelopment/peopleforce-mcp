# Using `peopleforce-mcp` with Claude Code

Claude Code is the official CLI from Anthropic. It stores MCP servers in `~/.claude.json`.

## Option 1 — One-command install (recommended)

```bash
claude mcp add peopleforce --scope user \
  --env PEOPLEFORCE_API_KEY=your_key_here \
  -- npx -y @empat/peopleforce-mcp
```

Verify:

```bash
claude mcp list
# → peopleforce: npx -y @empat/peopleforce-mcp - ✓ Connected
```

## Option 2 — Manual config

Edit `~/.claude.json` and add:

```json
{
  "mcpServers": {
    "peopleforce": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@empat/peopleforce-mcp"],
      "env": {
        "PEOPLEFORCE_API_KEY": "your_key_here"
      }
    }
  }
}
```

Restart Claude Code.

## Option 3 — Local checkout (for development)

```bash
git clone https://github.com/EmpatDevelopment/peopleforce-mcp.git
cd peopleforce-mcp && npm install && npm run build

claude mcp add peopleforce --scope user \
  --env PEOPLEFORCE_API_KEY=your_key_here \
  -- node "$(pwd)/dist/index.js"
```

## Sample prompts

- "How many people are currently on probation?"
- "Who is on vacation next week?"
- "List all open vacancies in the Back-end department."
- "Show me the position history of employee 290941."
- "What leave types does the company have?"
