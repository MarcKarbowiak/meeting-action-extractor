# Local File-Backed JSON Store vs Local Database

## Status
Accepted

## Context
The repository must be:

- Easy to run locally with zero infrastructure
- Aligned with Cosmos DB in Azure Mode
- Deterministic and testable in CI

A decision was required for Local Mode persistence:
- Use a local database (e.g., Postgres, SQLite)
- Or use a file-backed JSON document store

## Decision
Use a file-backed JSON document store in Local Mode.

Key characteristics:
- Single deterministic store file (`.local-data/store.json`)
- Stored in `.local-data/`
- Fully gitignored
- Deterministic and resettable for tests

The store implements the same logical interfaces expected by a future Cosmos adapter.

## Alternatives Considered

### 1. Local Postgres
Rejected because:
- Requires Docker or installed database
- Increases setup friction
- Adds operational complexity for reviewers

### 2. SQLite
Rejected because:
- Encourages relational modeling
- Diverges from Cosmos document model

## Consequences

Positive:
- Zero infrastructure to run
- Easy CI execution
- Clear document-first design
- Fast onboarding for reviewers

Negative:
- No database-level constraints
- Must implement concurrency and locking discipline in code
- Not intended for production

## Security Considerations

- `.local-data/` is gitignored
- No secrets stored locally
- Tenant isolation enforced in application layer

## Revisit Triggers

- If concurrency requirements exceed simple file locking
- If Local Mode must simulate production-scale load
- If Cosmos adapter is implemented and becomes default

