# PROJECT.md — Cirth (MCP Bug Ticketing Agent)

Architectural reference for the project: what the system is, why it is built this
way, and where it is going.

---

## 1. Purpose

A local MCP server exposing two tools — read a log file, create a bug ticket — so
an AI agent can turn a natural-language bug report into a structured, stored
ticket.

The scope is intentionally narrow. The system is a controlled environment for a
hard problem: an agent whose behaviour is probabilistic and whose operative rules
live in prose (tool descriptions) rather than in code paths. The test strategy
for that behaviour is documented separately in [`TESTING.md`](./TESTING.md).

---

## 2. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | TypeScript | ES2022 target. See §9 for the known `any` debt. |
| Runtime | Node.js | ≥ 18, `NodeNext` module resolution. |
| Protocol | `@modelcontextprotocol/sdk` | `Server` + request handlers. |
| Transport | stdio | One long-lived process; stdout is the protocol channel, stderr is for diagnostics (ADR-005). |
| Host | Claude Code | Registered as a project-scoped local MCP server. |
| Persistence | `mock_tickets.json` (flat file) | Mock backend; gitignored generated data (ADR-006). |

No web server, no database, no auth layer — deliberate non-goals at the current
scale (ADR-002). Items that would change this (Jira, SQL) are scoped in §8.

---

## 3. Architecture

### 3.1 Flow

```
┌───────┐     natural language      ┌──────────────────┐
│ User  │ ────────────────────────▶ │  Claude (agent)  │
└───────┘                           └────────┬─────────┘
                                             │ decides which tool, when
                          ┌──────────────────┼───────────────────┐
                          ▼                                       ▼
                  ┌───────────────┐                      ┌────────────────┐
                  │ read_log_file │                      │ create_ticket  │
                  │  logs/*.log   │                      │ writes ticket  │
                  └───────┬───────┘                      └────────┬───────┘
                          │ log text back to agent                │
                          └───────────────────────────────────────┘
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │  mock_tickets.json │
                                                        └────────────────────┘
```

The agent is the orchestrator. The server is a deterministic executor: it does
exactly what each tool specifies, validates inputs, and generates everything that
must not be left to the model.

### 3.2 Core design principle

**The model only ever sees the tool description.** It does not see handler code,
comments, or this document. Every rule the agent must follow — severity criteria,
"do not invent values", "judge by impact not framing" — therefore lives in the
`description` field of the tool schema, in plain English. Handler code enforces
only what is deterministic and security-critical: path containment, server-side
IDs and timestamps, defensive file I/O.

This split drives most of the ADRs in §7.

---

## 4. Tool contracts

### 4.1 `read_log_file`

| | |
|---|---|
| **Input** | `filename: string` (required) |
| **Output** | File contents prefixed with `--- {filename} ---`, or an error string with `isError: true`. |
| **Guard** | Path traversal. The requested name is resolved against `logs/` and the relative path is checked for containment. Empty, `..`-escaping, or absolute results are rejected (ADR-003). |

The description steers the agent to call this before ticketing whenever logs are
mentioned, so log evidence becomes the source of truth rather than the user's
recollection.

### 4.2 `create_ticket`

| Field | Type | Required | Source of truth |
|-------|------|----------|-----------------|
| `title` | string (≤100) | ✅ | model |
| `description` | string | ✅ | model |
| `severity` | `Critical \| High \| Medium \| Low` | ✅ | model (by impact, per description) |
| `component` | string | ✅ | model |
| `steps_to_reproduce` | string[] | ⬜ | model (defaults `[]`) |
| `version_affected` | string | ⬜ | model (defaults `null` — **must not be guessed**) |
| `id` | `MOCK-{epoch}` | — | **server** |
| `created_at` | ISO datetime | — | **server** |
| `status` | `"Open"` | — | **server** |

The optional fields are the hallucination tripwires: an agent under pressure tends
to fill `version_affected` with a plausible guess. The contract forbids this and
the test suite checks for it (see [`TESTING.md`](./TESTING.md) → Hallucination).

---

## 5. Data model

A stored ticket:

```jsonc
{
  "id": "MOCK-1715000000000",       // server-generated, MOCK-{Date.now()}
  "created_at": "2026-05-12T14:31:07.000Z",
  "status": "Open",                 // server-generated, always "Open" on create
  "title": "Payment timeout on Sunmi terminal during loyalty card transaction",
  "description": "...",
  "severity": "High",
  "component": "Payment Gateway",
  "steps_to_reproduce": ["1. ...", "2. ..."],
  "version_affected": "2.4.1"       // or null if unknown — never a guess
}
```

`mock_tickets.json` is a flat JSON array of these objects. Writes are
read-modify-write: the file is read defensively, the new ticket is pushed, the
whole array is written back (ADR-004).

---

## 6. Repo hygiene (public repo)

This is a public repository. Nothing identifying or proprietary lives in it.

- **No real logs.** `logs/` contains only synthetic fixtures written for the test
  scenarios. Real device or customer logs never enter the repo.
- **No real credentials.** When integrations land (§8), tokens / API keys / DB
  passwords are RAM-only or read from environment variables — never committed
  (ADR-007).
- **No machine-specific paths committed.** The `claude mcp add` command uses an
  absolute path; that is a setup instruction in the README, not checked-in config.
- **Generated data is gitignored.** `mock_tickets.json` and any future generated
  artifacts stay out of version control.
- **Generic example data.** Terminal names, components, versions, and ticket
  prefixes in examples and fixtures are illustrative, not drawn from any real
  system.

A pre-publish checklist lives in [`TESTING.md`](./TESTING.md) → Release hygiene.

---

## 7. Architecture Decision Records (ADR)

| # | Decision | Rationale |
|---|----------|-----------|
| 001 | Business rules live in tool *descriptions*, not handler code | The model only sees descriptions; that is the only place a rule can influence behaviour. |
| 002 | Flat JSON mock backend, no DB | Scale does not justify a database; a flat file keeps agent output trivially inspectable and testable. |
| 003 | Path guard via `resolve` + `relative` containment, not substring | A `..`/`/` substring check misses backslashes, absolute paths, and symlink escapes. Resolve-then-contain is the only reliable enforcement. |
| 004 | Defensive file I/O — corrupt state returns an error, never crashes | The server is long-lived; a bad `mock_tickets.json` must not take down the process or silently lose tickets. On read failure the write is aborted to avoid data loss. |
| 005 | stdout reserved for MCP protocol; logs go to stderr | Anything on stdout corrupts the protocol stream. Diagnostics use `console.error`. |
| 006 | `mock_tickets.json` gitignored | It is generated data, not source. |
| 007 | Secrets RAM-only / env, never committed | Applies pre-emptively to all future API-backed features (Jira, SQL). |
| 008 | Server generates `id` / `created_at` / `status` | Determinism shrinks the model's hallucination surface and makes output assertable in tests. |

---

## 8. Roadmap

Staged so each step adds a new class of agent behaviour to verify — the roadmap
and the test strategy grow together.

| Version | Scope | Testing surface it introduces | Status |
|---------|-------|-------------------------------|--------|
| **v0.2.0** | Two tools, mock backend, hardened path guard (current). | Tool selection, severity judgment, hallucination, framing resistance, path traversal. | ✅ current |
| **v0.3.0** | **Jira sandbox integration.** `create_ticket` optionally pushes to a Jira Cloud free sandbox; credentials via env (ADR-007). Toggle between mock and live backend. | Field mapping (severity→priority), idempotency, partial-failure handling, writing to the live system only when intended. | 🔜 next |
| **v0.4.0** | **Ticket lifecycle tools** — `search_tickets`, `update_ticket`, `link_duplicate`. | Wrong-record edits, duplicate detection, destructive-action confirmation. | TODO |
| **v0.5.0** | **Eval harness.** The scenarios in `TESTING.md` run programmatically with pass/fail scoring against a regression baseline. | Repeatable, measurable behavioural benchmark instead of manual runs. | TODO |
| **v0.6.0** | **Multi-log correlation.** Read several logs, correlate by timestamp, parse structured lines. | Cross-source reasoning, timestamp arithmetic, contradictory-evidence handling. | TODO |
| **v0.7.0** | **Uncertainty signalling.** Agent states when evidence is insufficient instead of producing a confident ticket. | Calibrated abstention. | TODO |

ADR-007 already defines the credential model for v0.3+, so Jira does not require a
security retrofit later.

---

## 9. Known technical debt

- **`any` in handlers.** `args?.title as string` and `catch (e: any)` use `any`.
  Target: a typed args interface per tool plus `unknown` + narrowing in catch
  blocks. First cleanup before v0.3.
- **No input length enforcement in code.** `title ≤ 100` is described to the model
  but not enforced server-side. Should be validated once tickets reach a real
  backend (v0.3).
- **Read-modify-write is not concurrency-safe.** Acceptable for a single stdio
  client; revisit if the backend becomes shared.

---

## 10. Conventions

- **Commits:** Conventional Commits — `feat(tool):`, `fix(guard):`,
  `docs(project):`, `test(agent):`, `refactor(server):`, `chore(deps):`.
- **Versioning:** SemVer. A new tool or backend = minor bump; behaviour fix = patch.
- **Changelog:** Keep a Changelog format; every change lands under `[Unreleased]`
  first.
- **Code style:** self-documenting names over comments. Comments explain *why*
  (e.g. the security rationale on the path guard), not *what*.
