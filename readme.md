# Meeting Action Extractor

A multi-tenant AI SaaS template that transforms unstructured meeting notes into structured, reviewable action items.

This repository is designed as a consulting-grade reference implementation demonstrating:

- Multi-tenant SaaS architecture
- Async processing with worker pattern
- Tenant isolation and RBAC enforcement
- AI-assisted structured extraction
- Local-first developer experience
- Azure-ready production architecture
- No secrets in code (Key Vault + Managed Identity in Azure mode)

---

## Why This Repository Exists

This project serves as:

1. A runnable demonstration of pragmatic AI-enabled SaaS design  
2. A reusable starting point for consulting engagements  
3. A reference for secure cloud-native architecture patterns  

It emphasizes disciplined system design, failure handling, and tenant safety over novelty.

---

## Features (v1)

- Submit meeting notes for extraction
- Async processing pipeline
- Suggested action items with confidence scores
- Approve / reject / edit tasks
- Export approved tasks as CSV
- Role-based access control (Admin, Member, Reader)
- Audit logging of key actions

---

## Architecture Modes

### Local Mode (Easy Run)

Runs entirely via Docker:

- React frontend
- Node.js API
- Worker process
- Postgres database
- Deterministic rules-based extractor

Start with:

```bash
docker compose up
