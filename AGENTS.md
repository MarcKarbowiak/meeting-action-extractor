# AGENTS.md — Instructions for Copilot Agent (Codex)

This repository is implemented and maintained using AI coding agents (Copilot Agent Mode).
All agents must follow these instructions.

---

## 0) Source of Truth

Before doing any work, read:

1) `PROJECT_PLAN.md`  
2) `SESSION_PRIMER.md`  
3) `README.md`

If any instructions conflict, **follow `PROJECT_PLAN.md`**.

---

## 1) Repo Goal

**meeting-action-extractor** is a demo-ready, consulting-grade multi-tenant system that extracts action items from meeting notes into reviewable tasks.

It must support two modes:

- **Local Mode:** runnable with `docker compose up` (no Azure required)
- **Azure Mode (reference):** architecture docs + IaC skeleton using **Key Vault + Managed Identity** (not required to run locally)

---

## 2) Hard Rules (Non-negotiable)

### No secrets in repo
- Never commit secrets (keys, tokens, connection strings, credentials).
- Azure Mode must use **Key Vault + Managed Identity**.
- Local Mode can use env vars for development only.
- Commit `.env.example` only (placeholders).

### Tenant isolation everywhere
- Every persisted record includes `tenant_id`.
- Every DB query filters by `tenant_id`.
- Every API request must carry tenant context.
- Never allow cross-tenant reads/writes.

### RBAC
Roles:
- `admin`
- `member`
- `reader`

Minimum permissions:
- Reader: read-only
- Member: submit notes + approve/reject/edit tasks
- Admin: manage tenant members + everything Member can do

### Incremental progress
- Work in small, reviewable changes.
- After each phase, run lint/typecheck/tests and fix until green.
- Avoid “big bang” refactors.

---

## 3) Preferred Stack & Conventions

### Monorepo
Use **pnpm workspaces**.

Recommended structure:

/apps
- web (React + TS + Vite)
- api (Node + TS)
- worker (Node + TS)

/packages
- shared (types, auth helpers, logger)
- db (migrations, DB client, repositories)
- extractor (provider interface + rules-based extractor)

/infra
- local (docker-compose, seed)
- azure (IaC skeleton + notes)

/docs
- architecture (local-vs-azure mapping)

### TypeScript
- Strict mode everywhere
- Shared types in `/packages/shared`

### Logging
- Structured logging (include `requestId` + `tenantId`)
- No sensitive data in logs

---

## 4) Build & Run Commands

### Install
```bash
pnpm install
