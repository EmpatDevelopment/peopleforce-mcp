# Using `peopleforce-mcp` with Claude Desktop

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

## 2. Edit the Claude Desktop config

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows  | `%APPDATA%\Claude\claude_desktop_config.json` |

Add (or merge) under `mcpServers`:

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

> ⚠️ Use an **absolute path** for `args[0]`. Claude Desktop does not expand `~` or `$HOME`.

## 3. Restart

Fully quit Claude Desktop (`⌘ Q` on macOS) and relaunch. The `peopleforce_*` tools appear in the tool menu of every new conversation.

## Updating

```bash
cd ~/peopleforce-mcp && git pull && npm install && npm run build
```

Restart Claude Desktop.
