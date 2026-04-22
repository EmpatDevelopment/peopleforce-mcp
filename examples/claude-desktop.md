# Using `peopleforce-mcp` with Claude Desktop

Claude Desktop reads MCP configuration from a JSON file:

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows  | `%APPDATA%\Claude\claude_desktop_config.json` |

Add (or merge) the following:

```json
{
  "mcpServers": {
    "peopleforce": {
      "command": "npx",
      "args": ["-y", "@empat/peopleforce-mcp"],
      "env": {
        "PEOPLEFORCE_API_KEY": "your_key_here"
      }
    }
  }
}
```

Fully quit Claude Desktop (`⌘ Q`) and relaunch. The `peopleforce_*` tools will appear in the tool menu of every new conversation.
