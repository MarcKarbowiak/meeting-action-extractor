locals {
  base_name = "${var.name_prefix}-${var.environment}"

  app_settings_common = {
    KEY_VAULT_URI                      = azurerm_key_vault.kv.vault_uri
    COSMOS_ACCOUNT_ENDPOINT            = azurerm_cosmosdb_account.cosmos.endpoint
    COSMOS_DATABASE_NAME               = azurerm_cosmosdb_sql_database.app.name
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.appi.connection_string
  }
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  lower   = true
  numeric = true
  special = false
}

resource "azurerm_resource_group" "rg" {
  name     = "${local.base_name}-rg"
  location = var.location
  tags     = var.tags
}

resource "azurerm_log_analytics_workspace" "law" {
  name                = "${local.base_name}-law-${random_string.suffix.result}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "appi" {
  name                = "${local.base_name}-appi-${random_string.suffix.result}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "web"
  tags                = var.tags
}

resource "azurerm_user_assigned_identity" "api_mi" {
  name                = "${local.base_name}-api-mi"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_user_assigned_identity" "worker_mi" {
  name                = "${local.base_name}-worker-mi"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_key_vault" "kv" {
  name                          = "${var.name_prefix}${var.environment}kv${random_string.suffix.result}"
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  enable_rbac_authorization     = true
  public_network_access_enabled = true
  tags                          = var.tags
}

resource "azurerm_role_assignment" "api_kv_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.api_mi.principal_id
}

resource "azurerm_role_assignment" "worker_kv_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.worker_mi.principal_id
}

resource "azurerm_cosmosdb_account" "cosmos" {
  name                = "${var.name_prefix}-${var.environment}-cosmos-${random_string.suffix.result}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.rg.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableServerless"
  }

  tags = var.tags
}

resource "azurerm_cosmosdb_sql_database" "app" {
  name                = "meeting_action_extractor"
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
}

resource "azurerm_cosmosdb_sql_container" "containers" {
  for_each = toset(var.cosmos_containers)

  name                = each.value
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos.name
  database_name       = azurerm_cosmosdb_sql_database.app.name
  partition_key_paths = ["/tenantId"]
}

resource "azurerm_role_assignment" "api_cosmos_data" {
  scope                = azurerm_cosmosdb_account.cosmos.id
  role_definition_name = "Cosmos DB Built-in Data Contributor"
  principal_id         = azurerm_user_assigned_identity.api_mi.principal_id
}

resource "azurerm_role_assignment" "worker_cosmos_data" {
  scope                = azurerm_cosmosdb_account.cosmos.id
  role_definition_name = "Cosmos DB Built-in Data Contributor"
  principal_id         = azurerm_user_assigned_identity.worker_mi.principal_id
}

resource "azurerm_service_plan" "app_plan" {
  name                = "${local.base_name}-asp"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1"
  tags                = var.tags
}

resource "azurerm_linux_web_app" "api" {
  name                = "${local.base_name}-api-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.app_plan.id
  https_only          = true
  tags                = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.api_mi.id]
  }

  site_config {
    always_on = true

    application_stack {
      node_version = "20-lts"
    }
  }

  app_settings = merge(local.app_settings_common, {
    WEBSITES_PORT = "3000"
    AZURE_CLIENT_ID = azurerm_user_assigned_identity.api_mi.client_id
  })
}

resource "azurerm_storage_account" "func_runtime" {
  name                            = lower(replace("${var.name_prefix}${var.environment}func${random_string.suffix.result}", "-", ""))
  resource_group_name             = azurerm_resource_group.rg.name
  location                        = azurerm_resource_group.rg.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = var.tags
}

resource "azurerm_key_vault_secret" "func_storage_connection" {
  name         = "worker-storage-connection-string"
  value        = azurerm_storage_account.func_runtime.primary_connection_string
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_linux_function_app" "worker" {
  name                = "${local.base_name}-worker-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.app_plan.id

  storage_account_name       = azurerm_storage_account.func_runtime.name
  storage_account_access_key = azurerm_storage_account.func_runtime.primary_access_key
  https_only                 = true
  tags                       = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.worker_mi.id]
  }

  site_config {
    application_stack {
      node_version = "20"
    }
  }

  app_settings = merge(local.app_settings_common, {
    AZURE_CLIENT_ID    = azurerm_user_assigned_identity.worker_mi.client_id
    AzureWebJobsStorage = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.func_storage_connection.versionless_id})"
  })
}

data "azurerm_client_config" "current" {}
