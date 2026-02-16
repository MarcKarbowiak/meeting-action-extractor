output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.rg.name
}

output "api_url" {
  description = "API default hostname"
  value       = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "worker_name" {
  description = "Function App name"
  value       = azurerm_linux_function_app.worker.name
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = azurerm_key_vault.kv.vault_uri
}

output "cosmos_endpoint" {
  description = "Cosmos DB endpoint"
  value       = azurerm_cosmosdb_account.cosmos.endpoint
}
