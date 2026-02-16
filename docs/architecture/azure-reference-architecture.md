# Azure Reference Architecture

This document defines the Azure reference topology for `meeting-action-extractor`.

## Reference Topology

- **Web**: Azure Static Web Apps (SPA hosting)
- **API**: Azure App Service (Linux)
- **Worker**: Azure Functions (Linux)
- **Storage**: Azure Cosmos DB for NoSQL
- **Secrets**: Azure Key Vault
- **Identity**: User-assigned Managed Identities for API and Worker
- **Observability**: Application Insights + Log Analytics

## Data Model and Cosmos Layout

Database: `meeting_action_extractor`

Containers (partition key `/tenantId`):
- `notes`
- `jobs`
- `tasks`
- `audit`
- `memberships`
- `users`

Design notes:
- Co-locate tenant data by partition key for query efficiency
- Keep idempotency key and processing metadata in `jobs`
- Keep audit trail immutable-style append in `audit`

## Security Architecture

### No Secrets Policy

- No credentials stored in repository
- No plaintext connection strings in app settings
- Use Key Vault secret references when a secret is required

### Managed Identity Access Pattern

- `api-mi` (user-assigned identity) attached to API App Service
- `worker-mi` (user-assigned identity) attached to Function App

RBAC assignments:
- `api-mi` -> Key Vault secrets read (`Key Vault Secrets User`)
- `worker-mi` -> Key Vault secrets read (`Key Vault Secrets User`)
- `api-mi` and `worker-mi` -> Cosmos DB data access role (documented equivalent in IaC)

## Runtime Configuration (Reference)

API app settings (examples):
- `COSMOS_ACCOUNT_ENDPOINT`
- `COSMOS_DATABASE_NAME`
- `KEY_VAULT_URI`
- `AZURE_CLIENT_ID` (API identity client id)
- `APPLICATIONINSIGHTS_CONNECTION_STRING`

Worker app settings (examples):
- `COSMOS_ACCOUNT_ENDPOINT`
- `COSMOS_DATABASE_NAME`
- `KEY_VAULT_URI`
- `AZURE_CLIENT_ID` (Worker identity client id)
- `AzureWebJobsStorage` via Key Vault reference
- `APPLICATIONINSIGHTS_CONNECTION_STRING`

## CI/CD Concept (Reference)

1. Pull request pipeline:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
2. Main branch deployment pipeline (future):
   - Provision/update infra via IaC
   - Deploy API and Worker
   - Deploy Web static assets
   - Run post-deploy smoke checks

## Scaling Guidance

- API: scale out by App Service instance count
- Worker: scale by Function concurrency and plan settings
- Cosmos DB: scale RU/s based on partition heat; isolate large tenants when needed

## Local Compatibility Guarantee

Azure reference artifacts do not alter Local Mode behavior. Local demo/test workflow remains cloud-independent.
