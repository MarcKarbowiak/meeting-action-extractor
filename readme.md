# meeting-action-extractor

Demo-ready, consulting-grade, multi-tenant app scaffold for extracting structured action items from meeting notes.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Seed Local Data

```bash
pnpm store:seed
```

This creates a demo tenant with admin and member users in `.local-data/store.json`.

### 3. Run the Application

Open **three terminals** and run:

**Terminal 1 - API Server:**
```bash
cd apps/api
pnpm dev
```
API runs at `http://localhost:3000`

**Terminal 2 - Worker (Task Extraction):**
```bash
cd apps/worker
pnpm dev
```
Worker polls for jobs every few seconds

**Terminal 3 - Web UI:**
```bash
cd apps/web
pnpm dev
```
Web UI runs at `http://localhost:5173`

### 4. Open the Web UI

1. Navigate to `http://localhost:5173`
2. Expand the **Dev Auth Context** panel at the top
3. Enter demo credentials:
   - **Tenant ID:** `tenant-demo-001`
   - **User ID:** `user-demo-admin`
   - **Email:** `admin@demo.local`
   - **Roles:** `admin,member`

### 5. Submit a Test Note

Click **"New Note"** and paste this sample:

```
Meeting: Weekly Team Sync - Feb 16, 2026

Attendees: @Hank (Manager), @Ira (Employee)

Discussion Points:
- Q1 Performance Review
- Development opportunities

Action Items:
ACTION: Hank to provide development plan by Friday
TODO: Ira to complete Q1 metrics report due 2026-02-20
NEXT: Schedule follow-up meeting @Sarah
FOLLOW UP: Review performance improvement plan with HR

Additional tasks:
- Set up mentorship sessions for Ira
- Document quarterly objectives
```

The worker will automatically extract **6 tasks** from this note within a few seconds!

### 6. Review Extracted Tasks

- Tasks appear automatically (page polls every 3 seconds while processing)
- Click **Approve**, **Reject**, or **Edit** for each task
- Export approved tasks as CSV

## Project Structure

- `apps/api` — Fastify REST API with tenant auth + RBAC
- `apps/worker` — Background job processor with rules-based extraction
- `apps/web` — React + MUI web interface
- `packages/db` — File-backed local store (tenant-isolated)
- `packages/extractor` — Rules-based task extraction engine
- `packages/shared` — Shared types/utilities
- `infra/local` — Local infrastructure placeholders
- `infra/azure` — Azure reference placeholders

## How Task Extraction Works

The rules-based extractor looks for:

**Keywords:**
- `ACTION:`
- `TODO:`
- `NEXT:`
- `FOLLOW UP:`

**Heuristics:**
- Bullet points starting with action verbs (e.g., "Schedule", "Review", "Complete")

**Metadata Parsing:**
- Owners: `@Name` or `Owner: Name`
- Due Dates: `YYYY-MM-DD` format

## Modes

### Local Mode (Current)

Local development runs offline without Azure dependencies.

- File-backed store at `.local-data/store.json`
- Deterministic seed data for demo tenant
- Tenant-scoped reads and writes
- Job queue for worker processing

### Azure Mode (Reference)

Azure mode is a reference architecture (not implemented yet).
Target: App Service + Functions + Key Vault + Managed Identity.

## Development Commands

From project root:

```bash
pnpm store:seed      # Seed local data
pnpm dev             # Start API only
pnpm dev:worker      # Start worker only
pnpm dev:web         # Start web UI only
pnpm worker:once     # Run worker once (manual)
pnpm test            # Run all tests
pnpm lint            # Lint all packages
pnpm typecheck       # Type check all packages
```

## API Details

### Authentication Headers

Request headers for auth context:

- `x-tenant-id` — Tenant identifier
- `x-user-id` — User identifier
- `x-user-email` — User email
- `x-user-roles` — Comma-separated roles: `admin`, `member`, `reader`

**Development mode:** Falls back to demo context if headers missing  
**Production mode:** Returns `401` if headers missing

### API Endpoints

- `GET /health` — Health check
- `GET /me` — Current user context
- `GET /notes` — List notes
- `POST /notes` — Create note (member+)
- `GET /notes/:id` — Get note details
- `GET /notes/:id/tasks` — Get tasks for note
- `PATCH /tasks/:id` — Update task (member+)
- `GET /tasks/export.csv?status=approved` — Export CSV

### Example curl Commands

**Health check:**
```bash
curl -H "x-tenant-id: tenant-demo-001" \
     -H "x-user-id: user-demo-admin" \
     -H "x-user-email: admin@demo.local" \
     -H "x-user-roles: admin" \
     http://localhost:3000/health
```

**Create note:**
```bash
curl -X POST http://localhost:3000/notes \
     -H "content-type: application/json" \
     -H "x-tenant-id: tenant-demo-001" \
     -H "x-user-id: user-demo-member" \
     -H "x-user-email: member@demo.local" \
     -H "x-user-roles: member" \
     -d '{"title":"Weekly Sync","rawText":"ACTION: Review budget\nTODO: Submit report"}'
```

**Export tasks as CSV:**
```bash
curl -H "x-tenant-id: tenant-demo-001" \
     -H "x-user-id: user-demo-member" \
     -H "x-user-email: member@demo.local" \
     -H "x-user-roles: member" \
     "http://localhost:3000/tasks/export.csv?status=approved"
```

## Security & Best Practices

### No Secrets Policy

- Never commit secrets, keys, tokens, or connection strings
- Use `.env.example` for placeholders only
- Azure mode must use Managed Identity + Key Vault

### Tenant Isolation

- Every record includes `tenantId`
- Every query filters by `tenantId`
- Cross-tenant access is prevented at the data layer

### RBAC (Role-Based Access Control)

**Roles:**
- `admin` — Manage tenant members + all member permissions
- `member` — Create notes, review/approve/edit tasks
- `reader` — View-only access

## Local Store and Azure Cosmos Mapping

The local store is intentionally simple so tests run without network access.

**Conceptual mapping to Cosmos DB for Azure mode:**
- Tenant isolation key: `tenantId`
- Recommended partition key: `/tenantId`
- All entities modeled with tenant ownership first

This keeps query patterns aligned with multi-tenant isolation and minimizes cross-partition access.

