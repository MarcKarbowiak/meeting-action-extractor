# Session Primer (for New Agent Sessions)

If you are starting a new Copilot Agent / Codex session in this repository, follow this checklist before making changes.

---

## 0) Hard Rules (Do Not Violate)

- No secrets in the repository. Never commit API keys, tokens, connection strings, or credentials.
- Azure Mode must use Key Vault + Managed Identity.
- Every database row and every query must be tenant-scoped (`tenant_id`).
- Enforce RBAC consistently (admin / member / reader).
- All changes must pass lint, typecheck, and tests before proceeding.

---

## 1) Read These Files First

- `AGENTS.md`
- `PROJECT_PLAN.md`
- `README.md`
- `/docs/architecture/local-vs-azure.md` (if present)

These define architecture boundaries and current project state.

---

## 2) Bring Repository to Known-Good State

Run:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

If any step fails, fix issues before adding new functionality.

---

## 3) Run the System Locally

```bash
docker compose up
```

Verify that:
- API starts
- Worker starts
- Web app loads
- Database is reachable

---

## 4) Check Current Project Status

Open `PROJECT_PLAN.md` and review:

- Current Status
- Completed Phases
- Next Up section

Do not start unrelated work.

---

## 5) After Completing a Phase

Before ending the session:

- Update `PROJECT_PLAN.md` (mark tasks complete, update status, add next steps)
- Ensure all tests are green
- Ensure no secrets were introduced
- Ensure tenant isolation is preserved

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## 6) Guiding Principle

This repository is a consulting-grade reference implementation.

Prioritize:
- Clarity
- Tenant safety
- Deterministic behavior
- Explicit failure handling
- Incremental progress

Do not introduce unnecessary complexity.

