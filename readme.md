# meeting-action-extractor

Demo-ready, consulting-grade, multi-tenant app scaffold for extracting structured action items from meeting notes.

## Modes

### Local Mode

Local development runs with Docker and does not require Azure.

Current Phase 1 scaffold includes:

- pnpm workspace monorepo
- strict TypeScript baseline
- lint/format tooling
- PostgreSQL 15 via Docker Compose

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
2. Run checks:
   - `pnpm typecheck`
   - `pnpm lint`
3. Start local database:
   - `docker compose up`

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
