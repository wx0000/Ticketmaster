# TicketMaster — MCP Bug Ticketing Agent

A local Model Context Protocol (MCP) server that lets an AI agent read log files
and create structured bug tickets from natural-language descriptions.

Built as a hands-on study project for testing AI agents in a QA context: how an
agent decides which tool to call, how it judges severity, and how it resists
hallucination and user framing.

## Tools

- **read_log_file** — reads a log file from the local `logs/` directory. Includes
  a path-traversal guard (rejects `..` and path separators).
- **create_ticket** — creates a structured ticket (title, description, severity,
  component, steps to reproduce, affected version) and stores it in
  `mock_tickets.json`. Server-side metadata (id, created_at, status) is generated
  by the server, not the model. Severity rules and an anti-hallucination clause
  live in the tool description, since that is the only thing the model sees.

## Stack

- TypeScript, Node.js (ES2022, NodeNext)
- @modelcontextprotocol/sdk
- Runs over stdio, registered as a local MCP server in Claude Code

## Setup

```bash
npm install
npm run build
```

Register the server locally (path is machine-specific, hence not committed):

```bash
claude mcp add ticketing-mcp --scope project -- node /absolute/path/to/dist/server.js
```

Then reconnect in Claude Code and try:

> A Sunmi terminal failed around 14:30, a loyalty-card payment did not complete,
> the customer got no points. Version 2.4.1. Check logs/terminal_sunmi.log and
> create a ticket.

The agent should call `read_log_file`, then `create_ticket`, populating
`mock_tickets.json`.

## Notes

`mock_tickets.json` is gitignored — it is generated test data, not source.
Run the agent yourself to populate it.

## Lessons learned

- Business rules (severity criteria, anti-hallucination) live in the tool
  description, not in handler code — the model only ever sees the description.
- Anything deterministic (ids, timestamps, status) is generated server-side to
  reduce the model's hallucination surface and keep output testable.
- Tool handlers use defensive I/O: a corrupted state file returns an error to the
  model instead of crashing the long-lived server process.
- Tested for sycophancy (agent held its severity judgment against an aggressive
  "this is definitely Critical" framing) and for hallucination (agent corrected a
  false user assumption using log evidence as the source of truth).