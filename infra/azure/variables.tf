variable "subscription_id" {
  description = "Azure subscription ID for deployment"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "environment" {
  description = "Environment name (e.g. dev, test, prod)"
  type        = string
  default     = "dev"
}

variable "name_prefix" {
  description = "Prefix for Azure resources"
  type        = string
  default     = "mea"
}

variable "tags" {
  description = "Tags applied to resources"
  type        = map(string)
  default = {
    project = "meeting-action-extractor"
    managed = "terraform"
  }
}

variable "cosmos_containers" {
  description = "Cosmos SQL containers to create"
  type        = list(string)
  default     = ["notes", "jobs", "tasks", "audit", "memberships", "users"]
}
