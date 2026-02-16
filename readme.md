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
