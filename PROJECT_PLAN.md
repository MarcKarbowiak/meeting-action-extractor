# Project Plan — meeting-action-extractor

## Purpose

Build a demo-ready, consulting-grade multi-tenant Meeting Action Extractor that:

- Runs locally with `docker compose up`
- Demonstrates async processing + worker pattern
- Enforces tenant isolation and RBAC
- Includes tests and CI
- Provides Azure reference architecture (Key Vault + Managed Identity)
- Contains no secrets in code

---

## Non-Goals (v1)

- Full production authentication integration (Azure auth hooks only)
- Full RAG / vector search implementation
- Mobile clients
- Advanced reporting or dashboards

---

## Architecture Summary

### Local Mode

- React + TypeScript (Web)
- Node.js + TypeScript API
- Node.js + TypeScript Worker
- Postgres (Docker)
- Deterministic Rules-Based Extraction Provider

### Azure Mode (Reference Only)

- Azure App Service (API)
- Azure Functions (Worker)
- Azure Key Vault
- Managed Identity
- DB Adapter abstraction for Cosmos or Postgres Flexible
- Optional Azure OpenAI provider (via adapter)

Azure infrastructure is documented but not required to run locally.

---

## Design Principles

- Every request must include tenant context.
- Every DB query must filter by tenant_id.
- RBAC must be enforced at API boundary.
- Async jobs must be idempotent.
- Failures must be explicit (no silent failure).
- Logs must include requestId and tenantId.

---

## Definition of Done (v1)

- `docker compose up` runs end-to-end demo
- Note submission → job enqueue → worker processing → suggested tasks visible
- Approve/reject/edit flow works
- CSV export works
- Unit and integration tests pass
- GitHub Actions CI runs successfully
- No secrets committed
- Documentation updated

---

## Phases

### Phase 1 — Scaffold
- [x] pnpm workspace setup
- [x] TypeScript strict config
- [x] ESLint + Prettier
- [x] Base README
- [x] Docker Compose skeleton

### Phase 2 — Database
- [x] Migrations for all tables
- [x] Seed script (1 tenant, 1 admin, 1 member)
- [x] Repository abstraction layer

### Phase 3 — API
- [x] Auth/tenant middleware
- [x] RBAC guards
- [x] Tenants endpoints
- [x] Notes endpoints
- [x] Tasks endpoints
- [x] Audit event logging

### Phase 4 — Worker
- [ ] Job polling loop
- [ ] Retry logic (max 3 attempts)
- [ ] Dead-letter handling
- [ ] Rules-based extraction provider
- [ ] Audit events for job lifecycle

### Phase 5 — Web
- [ ] Tenant selector
- [ ] Submit notes screen
- [ ] Task review screen
- [ ] Approve/reject/edit tasks
- [ ] CSV export trigger

### Phase 6 — Tests + CI
- [ ] Unit tests (extractor, RBAC, tenant enforcement)
- [ ] Integration tests (API + worker end-to-end)
- [ ] GitHub Actions workflow

### Phase 7 — Documentation
- [ ] docs/architecture/local-vs-azure.md
- [ ] Security / no-secrets policy
- [ ] Demo walkthrough in README

---

## Current Status

- Repo initialized: Yes (Phase 1, Phase 2, and Phase 3 complete)
- Last green commit: Local workspace checks passed (lint + typecheck + test)
- Known issues: None

---

## Next Up

Begin Phase 4 — Worker.

After Phase 4 completion:
- Update this file
- Mark Phase 4 complete
- Move Phase 5 to active

