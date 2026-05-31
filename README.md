# Cirth — MCP Bug Ticketing Agent

> A local Model Context Protocol (MCP) server exposing two tools — read a log file
> and create a structured bug ticket — that let an AI agent turn a natural-language
> bug report into a stored, structured ticket.

**Stack:** TypeScript · Node.js (ES2022, NodeNext) · `@modelcontextprotocol/sdk` · stdio transport · Claude Code

![status](https://img.shields.io/badge/status-active-success)
![version](https://img.shields.io/badge/version-0.2.0-blue)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Overview

A user describes a bug in plain language. The agent decides whether it needs log
evidence, optionally reads a log file, judges severity from actual impact, and
writes a structured ticket to a local mock backend. The agent only ever sees the
**tool descriptions** — all business rules (severity criteria, the
no-hallucination clause, judge-by-impact rule) live there, because the tool
description is the model's entire view of the system.

```
User → Claude (agent) → read_log_file ─┐
                                        ├─→ create_ticket → mock_tickets.json
                        (decides)  ─────┘
```

## Tools

| Tool | Purpose | Key safeguard |
|------|---------|---------------|
| `read_log_file` | Reads a file from the local `logs/` directory. | Path-traversal guard via `resolve` + `relative` containment (not a substring check). |
| `create_ticket` | Writes a structured ticket to `mock_tickets.json`. | Server generates `id` / `created_at` / `status`; severity and anti-hallucination rules live in the tool description. |

See [`PROJECT.md`](./PROJECT.md) for the full architecture, data model, and design
decisions (ADRs).

---

## Setup

**Requirements:** Node.js ≥ 18.x · npm ≥ 9.x · Claude Code

```bash
npm install
npm run build
```

Register the server locally. The path is machine-specific, so it is **not**
committed:

```bash
claude mcp add ticketing-mcp --scope project -- node /absolute/path/to/dist/server.js
```

Reconnect in Claude Code, then try:

> A Sunmi terminal failed around 14:30, a loyalty-card payment did not complete,
> the customer got no points. Version 2.4.1. Check `logs/terminal_sunmi.log` and
> create a ticket.

The agent should call `read_log_file`, then `create_ticket`, populating
`mock_tickets.json`.

---

## Documentation

| File | Contents |
|------|----------|
| [`PROJECT.md`](./PROJECT.md) | Architecture, data model, tool contracts, ADRs, roadmap. |
| [`TESTING.md`](./TESTING.md) | Test strategy for the agent — risk categories, scenarios, expected behaviour, pass criteria. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Versioned history (Keep a Changelog + SemVer). |
| [`CLAUDE.md`](./CLAUDE.md) | Engineering conventions for AI-assisted contributions. |

---

## Notes

- `mock_tickets.json` is **gitignored** — it is generated data, not source.
- `logs/` contains synthetic log fixtures for the test scenarios. Real logs never
  go in the repo (see [`PROJECT.md`](./PROJECT.md) → Repo hygiene).

## License

MIT.
