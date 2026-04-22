# Security Policy

## Reporting a Vulnerability

If you discover a security issue in `@empat/peopleforce-mcp`, please **do not open a public GitHub issue**. Instead, email **security@empat.tech** with:

1. A description of the issue and its impact.
2. Steps to reproduce (a minimal PoC is ideal).
3. The commit SHA / released version you tested against.

We aim to acknowledge reports within **2 business days** and to ship a fix or mitigation within **14 days** for high-severity issues.

## API Key Handling

This server requires a PeopleForce **Company API key**, which grants read/write access to all employee data in your PeopleForce account. Treat it like a production database password.

- Store it only in the `PEOPLEFORCE_API_KEY` environment variable (or your MCP client's encrypted config).
- Never commit it to version control. The provided `.gitignore` excludes `.env`.
- Never paste it into chat transcripts, Slack, Notion, or bug reports.
- Restrict the key to specific IPs on the PeopleForce **allow-list** whenever possible.
- Rotate the key immediately (PeopleForce → Settings → Open API keys → Revoke + Generate) if it is ever exposed.

## Read-Only by Design

Version 0.x of this server exposes **only GET endpoints**. It cannot create, update, or delete PeopleForce resources. If a future release adds mutating tools, they will be opt-in via an explicit feature flag.

## Supported Versions

Security fixes are provided for the latest minor release. Older releases receive fixes only for critical vulnerabilities.
