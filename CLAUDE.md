# CLAUDE.md — Engineering conventions

Conventions for AI-assisted contributions to Cirth, a local MCP
bug-ticketing agent. Read `PROJECT.md` for architecture and `TESTING.md` for the
test strategy before making non-trivial changes.

---

## Stack — do not change without confirmation

- **TypeScript**, target **ES2022**, module resolution **NodeNext**
- **Node.js** ≥ 18
- **`@modelcontextprotocol/sdk`** — `Server` + request handlers
- **stdio** transport (not HTTP)
- **Flat JSON** mock backend (`mock_tickets.json`) — not a database
- Host: **Claude Code** (project-scoped local MCP server)

No web framework, no DB, no auth layer. If a task seems to need one, stop and ask.

---

## The rule that defines this project

**The model only ever sees tool `description` fields.** Therefore:

- Anything the *agent* must decide (severity by impact, "don't invent values",
  "read logs first") goes in the tool **description**, in plain English.
- Anything **deterministic or security-critical** (IDs, timestamps, status, path
  containment, file I/O) goes in **handler code** — never left to the model.

When unsure where a rule belongs, ask: *does the model need to see this to behave
correctly?* If yes → description. If it must always hold regardless of the model →
code.

---

## Working rules

### Before generating code
1. State briefly **what you intend to change** and **what might be missed**.
2. Ask for confirmation before generating.
3. Touch **only the files the change needs** — do not regenerate the whole project.

### Code quality
- **No `any`.** Use a typed args interface per tool, and `unknown` + narrowing in
  catch blocks. (Existing `any` debt is tracked in `PROJECT.md` §9 — reduce it, do
  not add to it.)
- **No magic values.** Severity enum, tool names, the `logs/` dir, the backend
  filename → named constants.
- **Self-documenting names over comments.** Comments explain *why* (e.g. the
  security rationale on the path guard), not *what*.
- Any new tool or parser ships with a deterministic test (TESTING.md 🔧 style).
- Keep handlers small; extract a helper before a handler outgrows readability.

### Security / privacy (public repo)
- **Never** commit credentials, tokens, or API keys — RAM-only or env vars (ADR-007).
- **No real logs** — `logs/` holds synthetic fixtures only.
- `mock_tickets.json` stays **gitignored**.
- No machine-specific absolute paths in tracked files.
- Generic example data only (terminal names, versions, components, ticket prefixes).
- Run the pre-publish checklist (TESTING.md §5) before any public commit.

### Versioning & commits
- Each change → a **Conventional Commit** message: `feat(tool):`, `fix(guard):`,
  `docs(project):`, `test(agent):`, `refactor(server):`, `chore(deps):`.
- New tool or new backend = **minor** bump; behaviour fix = **patch**.
- Land every change under `[Unreleased]` in `CHANGELOG.md` first.
- Update `PROJECT.md` when architecture, ADRs, or the roadmap change. Update
  `TESTING.md` when a roadmap step adds a new agent-risk surface.

---

## What NOT to do

- Don't put business rules (severity, anti-hallucination) in handler code where the
  model can't see them — they belong in the tool description.
- Don't let the model generate `id`, `created_at`, or `status` — server only.
- Don't weaken the path guard to a substring check (ADR-003).
- Don't write to stdout — it's the protocol channel; logs go to stderr (ADR-005).
- Don't add `any`. Don't add a database. Don't add HTTP transport. Don't change the
  stack without confirmation.
- Don't commit real logs, secrets, or machine paths.
- Don't regenerate the whole project for a small change.
