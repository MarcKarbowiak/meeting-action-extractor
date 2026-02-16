# Azure IaC Skeleton (Terraform)

This folder contains a **reference Terraform skeleton** for Azure Mode.

It is intentionally minimal and does not change Local Mode behavior.

## What is provisioned

- Resource Group
- Log Analytics Workspace
- Application Insights
- Key Vault (RBAC enabled, purge protection enabled)
- User-assigned Managed Identities:
  - API identity
  - Worker identity
- Cosmos DB account + SQL database + containers:
  - notes, jobs, tasks, audit, memberships, users
  - partition key `/tenantId`
- App Service Plan + Linux Web App (API)
- Storage Account (Functions runtime)
- Linux Function App (Worker)
- RBAC assignments:
  - API/Worker -> Key Vault Secrets User
  - API/Worker -> Cosmos DB Built-in Data Contributor

## Prerequisites

- Azure CLI authenticated: `az login`
- Terraform installed
- Contributor-level access to target subscription

## Quick deploy

```bash
cd infra/azure
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` values.

Then run:

```bash
terraform init
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

## Post-deploy configuration notes

- Deploy API package to the created App Service
- Deploy Worker package to the created Function App
- Configure Web separately (recommended: Static Web Apps)
- Confirm app settings use Key Vault references where secrets are needed

## Security notes

- No secrets are hardcoded in repository
- Key Vault references are used for runtime secret resolution
- Managed Identity is used for service-to-service auth patterns

## Important

This is a reference skeleton only. Local development and tests do **not** require Azure.
