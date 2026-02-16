# Managed Identity and Key Vault as the Only Secret Distribution Mechanism

## Status
Accepted

## Context
The meeting-action-extractor repository supports two modes:

- Local Mode (no cloud dependencies)
- Azure Mode (reference architecture)

Azure deployments require secure handling of secrets such as:

- Cosmos DB connection configuration
- OpenAI endpoint configuration (if enabled)
- Storage account references

Hardcoding secrets or committing configuration values is unacceptable for a consulting-grade implementation.

## Decision
In Azure Mode:

- All secrets must be stored in Azure Key Vault.
- Applications (API and Worker) must authenticate using Managed Identity (MI).
- No secrets may be stored in code, environment files, or deployment scripts.
- Where possible, App Service and Function App configuration should use Key Vault references.

Local Mode does not require secrets and therefore does not use Key Vault.

## Alternatives Considered

### 1. Environment Variables with Manual Secret Injection
Rejected because:
- Secrets may leak in logs or config files
- Operational discipline depends on manual processes

### 2. Azure App Configuration without Key Vault
Rejected because:
- Still requires secret storage
- Key Vault is the standard Azure secret management solution

## Consequences

Positive:
- Strong security posture
- No credential rotation burden in application code
- Clear separation of identity and secret management

Negative:
- Slightly more complex infrastructure setup
- Requires correct RBAC assignments for MI

## Security Considerations

- Managed Identity eliminates embedded credentials.
- Key Vault RBAC must follow least-privilege principle.
- Access policies should be limited to required secret operations (get/list only).

## Revisit Triggers

- If multi-cloud support becomes a requirement
- If a secrets abstraction layer is introduced
- If Azure identity mechanisms materially change

