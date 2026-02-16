# Document-Oriented Schema with Tenant Partitioning vs Relational Schema

## Status
Accepted

## Context
The system is designed to align with Azure Cosmos DB (NoSQL API) in Azure Mode while remaining infrastructure-free in Local Mode.

The domain includes:
- Tenants
- Notes
- Extraction Jobs
- Suggested Tasks
- Audit Events

The system is strongly tenant-partitioned, with tenantId as a required context on every request.

## Decision
Adopt a document-oriented data model with tenant-based partitioning.

Key principles:
- Each document includes tenantId (partition key in Cosmos).
- Collections are logically separated by entity type.
- No cross-tenant joins.
- Application layer enforces unique constraints where necessary.

This design aligns directly with Cosmos DB's partition model and scales naturally by tenant.

## Alternatives Considered

### 1. Relational Schema (Postgres)
Rejected for v1 because:
- Adds infrastructure friction in Local Mode
- Encourages relational joins not aligned with Cosmos target
- Increases cognitive load for reviewers

### 2. Hybrid (Relational locally, Document in Azure)
Rejected because:
- Divergent models increase complexity
- Harder to reason about consistency

## Consequences

Positive:
- Direct Cosmos alignment
- Natural tenant isolation via partition key
- Flexible schema evolution
- Easier horizontal scalability

Negative:
- No database-enforced relational constraints
- Must enforce uniqueness and integrity in application logic

## Security Considerations

- Partition key = tenantId enforces logical tenant boundaries
- Application layer must strictly validate tenant context
- No cross-tenant query capabilities exist

## Revisit Triggers

- If complex relational queries become required
- If reporting or analytics require cross-tenant joins
- If Cosmos usage patterns change

