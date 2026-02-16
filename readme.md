# meeting-action-extractor

Demo-ready, consulting-grade, multi-tenant app scaffold for extracting structured action items from meeting notes.

## Modes

### Local Mode

Local development runs offline and does not require Azure.

Current Phase 2 local data model uses a file-backed store at `/.local-data/store.json`:

- deterministic seed data for demo users/tenant
- tenant-scoped reads and writes
- queued job storage for worker simulation

Postgres 15 is still included in `docker-compose.yml` as the local infrastructure target for upcoming phases.

Current scaffold includes:

- pnpm workspace monorepo
- strict TypeScript baseline
- lint/format tooling
- PostgreSQL 15 via Docker Compose
- file-backed local store for tests and seed

### Azure Mode (Reference)

Azure mode is a reference architecture only in this phase (not implemented/runnable yet).
Target design includes App Service + Functions + Key Vault + Managed Identity.

## No Secrets Policy

- Never commit secrets, keys, tokens, or connection strings.
- Use `.env.example` for placeholders only.
- Azure mode must use Managed Identity + Key Vault.

## Quick Start

1. Install dependencies:
   - `pnpm install`
2. Seed the local store:
   - `pnpm store:seed`
2. Run checks:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
3. Start local database:
   - `docker compose up`

## API (Phase 3)

Start API locally:

- `pnpm dev`

Default API address:

- `http://localhost:3000`

### Dev Auth Headers

Local mode uses request headers for auth context:

- `x-tenant-id`
- `x-user-id`
- `x-user-email`
- `x-user-roles` (comma-separated: `admin`, `member`, `reader`)

If headers are missing and mode is not production, API falls back to seeded demo context.
In production mode, missing headers return `401`.

### JWT Adapter Placeholder (Azure)

A placeholder adapter exists at [apps/api/src/auth/JwtAuthAdapter.ts](apps/api/src/auth/JwtAuthAdapter.ts).
This is where Azure JWT validation will be implemented later.

### Example curl Commands

Health:

- `curl -H "x-tenant-id: tenant-demo" -H "x-user-id: user-admin-demo" -H "x-user-email: admin@demo.local" -H "x-user-roles: admin" http://localhost:3000/health`

Create note:

- `curl -X POST http://localhost:3000/notes -H "content-type: application/json" -H "x-tenant-id: tenant-demo" -H "x-user-id: user-member-demo" -H "x-user-email: member@demo.local" -H "x-user-roles: member" -d "{\"title\":\"Weekly Sync\",\"rawText\":\"Need follow-up on budget approvals\"}"`

List tasks as CSV:

- `curl -L -H "x-tenant-id: tenant-demo" -H "x-user-id: user-member-demo" -H "x-user-email: member@demo.local" -H "x-user-roles: member" "http://localhost:3000/tasks/export.csv?status=approved"`

## Local Store and Azure Cosmos Mapping

The local store is intentionally simple and deterministic so tests run without network access.

Conceptual mapping to Cosmos DB for Azure mode:

- tenant isolation key: `tenantId`
- recommended partition key: `/tenantId`
- entities (tenants, memberships, notes, jobs) are modeled with tenant ownership first

This keeps query patterns aligned with multi-tenant isolation and minimizes cross-partition access.

## Repository Layout

- `apps/api` — API service scaffold
- `apps/worker` — background worker scaffold
- `apps/web` — web app scaffold
- `packages/shared` — shared types/util scaffold
- `packages/db` — database package scaffold
- `packages/extractor` — extraction package scaffold
- `infra/local` — local infrastructure placeholders
- `infra/azure` — Azure reference placeholders
- `docs/architecture` — architecture docs placeholders
