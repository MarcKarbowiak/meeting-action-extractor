# Local vs Azure Reference Architecture

This repository supports two modes:

- Local Mode (fully runnable, no cloud dependency)
- Azure Mode (reference architecture + IaC skeleton)

Local Mode remains the default for development, testing, and demos. Azure Mode is for consulting-grade architecture guidance and deployment planning.

## Component Mapping

| Capability | Local Mode | Azure Mode (Reference) |
|---|---|---|
| Web UI | Vite dev server | Azure Static Web Apps (preferred) |
| API | Node/Fastify process | Azure App Service (Linux Web App) |
| Worker | Node worker loop | Azure Functions (Linux Function App) |
| Persistence | Local JSON file store | Azure Cosmos DB for NoSQL |
| Secrets | `.env` placeholders only | Azure Key Vault + Managed Identity |
| Identity | Dev header context | Managed Identity for service-to-service |
| Observability | Console logs | Application Insights + Log Analytics + OpenTelemetry-compatible traces |

## Web Hosting Choice: Static Web Apps vs App Service

Chosen reference: **Azure Static Web Apps** for the web tier.

Why:
- Built-in global edge distribution and TLS
- Simple CI/CD integration for front-end deployments
- Cost-effective for static SPA workloads

Tradeoff:
- If you need tightly coupled server-rendered behavior in one host, App Service can simplify topology.
- For this architecture (SPA + separate API), Static Web Apps is typically the cleaner fit.

## Tenant Isolation Strategy (Cosmos DB)

Primary strategy:
- Partition key for all operational containers: `/tenantId`
- Every document includes `tenantId`
- Every query filters by `tenantId`

Container-per-collection approach:
- `notes`
- `jobs`
- `tasks`
- `audit`
- `memberships`
- `users`

Benefits:
- Predictable RU usage by tenant
- Reduced cross-partition fan-out
- Clear operational boundaries by entity type

Large tenant strategy (optional):
- Move high-scale tenants to dedicated environment/subscription when needed
- Keep same document shape and partition strategy to minimize migration complexity

## Secrets and Identity (No Secrets Policy)

Rules:
- No secrets in source control
- No hardcoded keys/connection strings in code or IaC
- Use Key Vault references for runtime secrets when required

Access model:
- API and Worker each use Managed Identity
- Managed Identities receive:
  - Key Vault secrets read permissions (`get/list` via RBAC)
  - Cosmos DB data access role (documented in IaC skeleton)

## Observability Mapping

- App and worker telemetry flow to Application Insights
- Logs and metrics retained in Log Analytics workspace
- Tracing model maps to OpenTelemetry concepts:
  - request span (API)
  - background job span (worker)
  - correlation via request/job identifiers

## Deployment Flow (Conceptual)

1. CI validates: lint, typecheck, tests
2. IaC deploys platform resources (RG, KV, Cosmos, App Service, Functions, identities)
3. App deployment publishes API and Worker artifacts
4. Runtime configuration resolves secret values from Key Vault
5. Smoke checks verify API health and worker job processing

## Important Non-Goal

Azure resources are **not required** for local tests or local demo execution. Local Mode remains unchanged and self-contained.
