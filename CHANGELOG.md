# Changelog

All notable changes to TicketMaster follow [Keep a Changelog](https://keepachangelog.com/)
and [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — current state (server reports v0.2.0)

### Added
- MCP server (`@modelcontextprotocol/sdk`) over stdio, registered as a
  project-scoped local server in Claude Code.
- **`read_log_file`** tool — reads a file from the local `logs/` directory.
  Description steers the agent to read logs before ticketing when logs are
  mentioned.
- **`create_ticket`** tool — writes a structured ticket to `mock_tickets.json`.
  Required: `title`, `description`, `severity`, `component`. Optional:
  `steps_to_reproduce`, `version_affected`. Server generates `id`, `created_at`,
  `status`.
- Business rules (severity criteria, "judge by impact not framing",
  "do not invent values") embedded in the `create_ticket` description — the only
  surface the model sees (ADR-001).
- Defensive write path: corrupt/empty `mock_tickets.json` returns a clean error
  and aborts the write to avoid data loss instead of crashing the long-lived
  server (ADR-004).
- Server-side field generation for `id` / `created_at` / `status` to shrink the
  model's hallucination surface and keep output assertable (ADR-008).
- stderr-only diagnostics; stdout reserved for the MCP protocol stream (ADR-005).
- Full documentation set: `PROJECT.md` (architecture + ADRs + roadmap),
  `TESTING.md` (agent test strategy), `README.md`, `CLAUDE.md`.

### Security
- **Path-traversal guard** on `read_log_file`: the filename is resolved against
  `logs/` and checked for containment via `path.relative`. Rejects `..`-escaping,
  absolute paths, backslash escapes, and empty input — chosen over a substring
  check because substring checks miss those cases (ADR-003).
- Repo hygiene rules documented: synthetic logs only, gitignored generated data,
  no committed credentials or machine-specific paths (ADR-006, ADR-007).

### Known issues / debt
- `any` used in handler arg access (`args?.title as string`) and catch blocks
  (`catch (e: any)`). Scheduled for cleanup before v0.3 — see `PROJECT.md` §9.
- `title ≤ 100` is described to the model but not enforced server-side.
- Read-modify-write on the JSON backend is not concurrency-safe (acceptable for a
  single stdio client).

### Commit message
```
docs: add full documentation set (PROJECT, TESTING, README, CLAUDE)

- Document architecture, data model, and tool contracts in PROJECT.md
- Add ADR-001..008 (rules-in-description, path guard, defensive I/O, etc.)
- Add TESTING.md: agent risk categories + scenarios (sycophancy,
  hallucination, evidence-over-assertion, tool selection, path traversal)
- Add roadmap: Jira sandbox (v0.3) → lifecycle tools → eval harness
- Rewrite README with project rationale and doc index
- Add CLAUDE.md working agreement
- Note known any-debt and concurrency caveat honestly
```

---

> No tagged releases yet. The first tag will be cut when the documented v0.2.0
> state is committed and the deterministic test suite (TESTING.md §3, 🔧 cases)
> is green.
