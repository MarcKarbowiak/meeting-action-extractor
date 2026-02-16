# AGENTS.md — Repo Instructions for Copilot Agent (Codex)

This repository is intended to be implemented and evolved using AI coding agents (Copilot Agent Mode).
These instructions are mandatory for any agent making changes.

---

## Repo Goal

Build a demo-ready, consulting-grade reference implementation:

**meeting-action-extractor**
A multi-tenant app that extracts structured action items from meeting notes into reviewable tasks.

Two modes:
- **Local Mode:** runnable with `docker compose up` (no Azure required)
- **Azure Mode:** reference architecture (App Service + Functions + Key Vault + Managed Identity), not required to run locally

---

## Hard Rules (Non-negotiable)

### No secrets in repo
- Never commit secrets (keys, tokens, connection strings) anywhere.
- Do not paste secrets into code, tests, docs, or examples.
- Azure Mode must use **Managed Identity + Key Vault** for secrets.
- Local Mode may use environment variables for dev-only (provide `.env.example` placeholders only).

### Tenant isolation required everywhere
- Every record must include `tenant_id`.
- Every query must filter by `tenant_id`.
- Every API endpoint must enforce tenant context.
- Never allow cross-tenant reads or writes.

### RBAC
Roles:
- `admin`
- `member`
- `reader`

Permissions:
- Reader: view-only
- Member: create notes, review/approve/edit tasks
- Admin: manage tenant members + everything Member can do

### Incremental delivery
- Work in small, reviewable commits.
- Do not perform “big bang” refactors.
- Keep changes scoped to the active phase.

---

## Coding Standards

- TypeScript strict mode for all apps/packages.
- Prefer small modules and clear boundaries.
- Keep API/worker logic behind interfaces (“ports/adapters” style).
- Write structured logs with `requestId` and `tenantId`.

---

## Commands (Local Dev)

### Start everything
```bash
docker compose up
