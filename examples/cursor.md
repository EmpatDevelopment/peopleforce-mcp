# Using `peopleforce-mcp` with Cursor

Cursor supports MCP servers via Settings → MCP → "Add new MCP server", or directly in `~/.cursor/mcp.json`:

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

Reload the Cursor MCP panel — the tools should appear under the `peopleforce` server with a green status indicator.
