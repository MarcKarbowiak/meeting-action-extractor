# Repository Interview Question Bank

## Topics

- Architecture & system design (multi-tenant, async pipeline, adapters)
- Technology & tooling tradeoffs (pnpm workspaces, Fastify, Vite/React, Terraform)
- Code structure & implementation patterns (tenant scoping, idempotency, data modeling)
- DevSecOps & supply chain controls (CI gates, secret handling, provenance)
- Reliability & testing strategy (unit/integration/E2E, failure modes)
- Observability & telemetry (OpenTelemetry spans, logging, sensitive data handling)
- Progressive delivery & deployment model (feature flags, controlled delete, release safety)
- Governance & risk (AI/provider governance, privacy, auditability)
- Scalability & performance (partitioning assumptions, concurrency, backpressure)
- Cost & operational tradeoffs (Cosmos RU, tracing volume, hosting choices)

---

## 1. Architecture & System Design

1. This repo targets “Local Mode” while mapping to an Azure reference architecture. What invariants must remain identical between local file-store and future Cosmos DB adapter so that business logic and tests remain valid?
2. The system is explicitly multi-tenant with “partition key = tenantId”. How do you enforce tenant isolation at each layer (request auth, repositories/store, background worker), and what is your defense-in-depth story if one layer is compromised?
3. Why is the core pipeline modeled as API → job enqueue → worker processing rather than synchronous extraction during note submission? What’s the latency/UX tradeoff and how did you choose it?
4. The data model is document-oriented and aligned with Cosmos (see [docs/adr/002_document_schema_vs_relational_schema.md](docs/adr/002_document_schema_vs_relational_schema.md)). Where do you deliberately avoid relational constraints, and what compensating controls exist in code to prevent integrity drift?
5. The worker retries up to 3 attempts. How did you decide on retry count and what is the contract between “job retry” and “task suggestion idempotency”?
6. How do you prevent duplicate task suggestions if the worker crashes mid-flight after writing tasks but before marking the job complete?
7. The worker sets note status (submitted → processing → ready/failed). What is the state machine, and what invariants do you enforce so that a note can’t end up in an impossible state?
8. What are your consistency expectations between job status and note status? Can they diverge, and if they do, how should the system reconcile them?
9. The API returns `404` when delete is disabled by a feature flag (as a concealment pattern). Why `404` instead of `403`/`405`, and what are the security vs debuggability tradeoffs?
10. The repo includes a Postgres service in docker-compose but Local Mode uses a JSON store. Why keep Postgres in the local topology? What decision boundary would make you switch Local Mode to Postgres/SQLite?
11. In Azure reference mode, the web tier is recommended as Static Web Apps. Under what conditions would you reject that and choose App Service (or Container Apps) instead?
12. The local web client uses dev headers as the “auth context”. If you replace this with real identity (Entra), what parts of the API contract and RBAC model would change, and what must remain stable?
13. The store abstraction is currently a concrete LocalJsonStore. If you were to formalize an interface boundary (repository pattern), where would you draw the seam and how would you manage migrations between implementations?
14. Audit events are written for note/job/task lifecycle. What is the authoritative audit log domain model—what constitutes an auditable event vs a diagnostic event—and how would you enforce immutability in Azure?
15. “No secrets in repo” is a hard rule, but local dev still uses placeholder configuration (see [.env.example](.env.example)). What is your threat model for local dev and how do you prevent “developer convenience” from leaking into production patterns?
16. If a tenant needs data export (tasks, notes, audit), what is your data portability strategy and how do you enforce tenant-only access during export?
17. If you had to support “tenant deletion” (right to be forgotten), what data would need to be deleted, what would you retain, and how would you prove deletion?
18. How do you version the extraction behavior so that re-processing older notes yields consistent results (or intentionally updated results) across releases?
19. The worker currently chooses a provider (rules-based) by default. What is the long-term provider architecture (LLM provider, hybrid, rule tuning) and how do you avoid coupling API/worker to provider specifics?
20. What are your explicit non-goals that you are protecting (e.g., “no RAG in v1”)? How do you prevent the repo from accidentally drifting into production-like scope?

## 2. Technology & Tooling Choices

1. Why Fastify for the API instead of Express/NestJS? What features do you rely on (hooks, injection testing, logging) and what do you give up?
2. Why pnpm workspaces instead of npm/yarn/monorepo tools (Nx/Turbo)? What operational pain or benefit are you optimizing for?
3. You chose Zod for validation. Where do you validate (API boundary only vs internal) and how do you keep schemas aligned with shared types without duplication?
4. Why Vite + React for the web tier, and what is the plan for production builds and hosting (especially given the Azure reference suggests Static Web Apps)?
5. The store uses a file-backed JSON database. What are the concurrency constraints, and why is this acceptable for Local Mode while still being “consulting-grade”?
6. You initialize telemetry with OpenTelemetry NodeSDK. Why choose OTLP HTTP exporter and console fallback, and how do you plan to handle metrics/log correlation later?
7. Feature flags are implemented via env vars and request headers. Why not use a feature flag service (App Configuration, LaunchDarkly), and what is the migration plan?
8. CI uses GitHub Actions with lint/typecheck/test + Playwright E2E. Why is E2E gated behind “quality” (needs) and what does that imply about feedback time?
9. Terraform is used for Azure IaC skeleton. Why Terraform instead of Bicep for a Microsoft-native story, and how would you justify this to an Azure-focused customer?
10. The Azure IaC provisions App Service + Functions. Why not Container Apps for both API and worker? What are the pros/cons in identity, scaling, and cost?
11. How do you decide which packages belong in packages/shared vs being app-local? What prevents shared from becoming a dumping ground?
12. For the worker, why a polling loop vs a queue-triggered model (Service Bus, Storage Queues, Functions triggers)? What reliability tradeoffs are you making?

## 3. Code Structure & Implementation Patterns

1. Walk through exactly how tenant context is derived and propagated for a request (see deriveAuthContext in [apps/api/src/auth.ts](apps/api/src/auth.ts) and request hook in [apps/api/src/app.ts](apps/api/src/app.ts)). What are the potential bypasses?
2. The RBAC model implements “reader is GET-only” and “member/admin can write”. What edge cases exist (e.g., POST endpoints that are safe, GET endpoints that leak)?
3. The API uses a custom JSON body parser and returns structured ApiError payloads. What classes of input failures are you explicitly trying to handle, and what failures are still ambiguous?
4. The store’s `lockNextJob` mutates the job in-place after reading the whole file. How does this behave with two worker processes? What would you change to make locking safe?
5. Suggested task IDs are derived from jobId + ordinal (jobId:suggested:NNN). Why this scheme? How does it interact with retries and partial failures?
6. `replaceSuggestedTasksForJob` deletes existing suggested tasks for the job and inserts new ones. How does this interact with “approve task” (status changes) and subsequent re-processing?
7. Where do you handle validation of task updates (title/owner/dueDate)? Are you relying on Zod only, and is there domain validation missing?
8. The API uses route-level spans and child spans for store/audit operations. How do you ensure span cardinality and attribute cardinality won’t explode in production?
9. The web client builds dev headers from localStorage and uses them on every request ([apps/web/src/api/client.ts](apps/web/src/api/client.ts)). How do you prevent these headers from ever being used in production builds?
10. The controlled delete feature returns `404` when disabled and requires admin role when enabled. What’s the reasoning behind “404 concealment + admin gate”, and how do you test it?
11. Where does the system enforce “every persisted record includes tenantId”? Is it a type-level guarantee, runtime checks, or purely by convention?
12. If you were asked to add “organization-level roles” (cross-tenant admin), what parts of the code structure would have to change and why?

## 4. DevSecOps & Supply Chain Controls

1. What is the repo’s current “security posture” beyond “no secrets”: dependency hygiene, vulnerability scanning, SAST, secret scanning—what’s present and what’s intentionally absent?
2. CI runs lint/typecheck/test and E2E. What prevents a compromised dependency from exfiltrating secrets during CI (especially given GitHub Actions permissions)?
3. How do you manage supply chain controls for pnpm (lockfile enforcement, integrity, registries)? What happens if the lockfile is missing?
4. How would you add provenance (SLSA-style) and artifact signing for API/worker builds if this moved toward production?
5. The Azure reference uses Managed Identity + Key Vault. How do you scope Key Vault RBAC to least privilege for API vs worker? What operations should each identity have?
6. Cosmos DB access is assigned as “Built-in Data Contributor”. Is that too broad? What would a least-privilege data plane model look like?
7. Where would you enforce TLS, HSTS, and security headers in the web tier given Static Web Apps vs App Service differences?
8. How do you handle PII and sensitive data: meeting notes can contain HR/finance info. What do you log, what do you trace, and what do you store?
9. The API supports CSV export. What are the injection risks (CSV formula injection), and how would you mitigate them?
10. How do you plan to rotate secrets in Azure Mode if you later introduce keys (e.g., OpenAI key) and still keep MI + Key Vault as the only distribution mechanism?
11. What is your approach to tenant-level data access auditing (who accessed what, when)? How would you capture read events without exploding storage cost?
12. If you needed to pass a customer security review, what missing artifacts would you create first (threat model, data flow diagram, SBOM, incident response)?

## 5. Reliability & Testing Strategy

1. Your tests span unit/integration/E2E. What is the contract between these layers—what must be covered by unit tests vs integration vs Playwright?
2. In [apps/api/test/api.test.ts](apps/api/test/api.test.ts), you use Fastify injection. What reliability issues does injection testing catch, and what does it miss compared to real HTTP/network tests?
3. The worker pipeline test simulates provider failure and retries. What other failure classes should be tested (store corruption, partial writes, clock skew, large payloads)?
4. How do you prevent flaky E2E tests given the worker is asynchronous and UI polls? What mechanisms ensure determinism?
5. What is the strategy for test data isolation, especially since the store is a file in .local-data? How do you guarantee parallel test safety?
6. What are your idempotency guarantees for job processing? Which operations are safe to retry and which are not?
7. If the JSON store file (store.json as written by LocalJsonStore; see [packages/db/src/store.ts](packages/db/src/store.ts)) becomes corrupted (partial write, invalid JSON), what happens at runtime? What is your recovery story?
8. What is your strategy for schema evolution in a document store: adding new fields, changing enums, backfilling—especially across local and Azure modes?
9. Where do you test tenant isolation for non-read operations (cross-tenant updates, cross-tenant membership changes, cross-tenant exports)?
10. The API uses a dev fallback auth context in non-production modes. How do you test that this cannot leak into production behavior?
11. How do you test observability behavior (span naming, error recording, sensitive attribute exclusion) without binding tests to OTel internals?
12. What would your “release confidence” checklist be before demoing this live (or handing it to a customer) given the async worker and local dev auth?

## 6. Observability & Telemetry

1. Which signals are considered “required” vs “nice to have” for this system (traces, logs, metrics), and how do you justify the current focus on traces?
2. Spans include tenantId/userId/requestId/jobId/noteId. Which of these are safe in production (PII risk + cardinality), and how do you sanitize or hash them?
3. The current exporter selection is console by default, OTLP when configured. How do you ensure this does not produce unexpected telemetry volume/cost in Azure?
4. How do you correlate API request spans with worker job spans end-to-end? What is the cross-service correlation ID strategy?
5. What is your sampling strategy and how would it change between dev/test/demo/prod? How do you validate that sampling still preserves failure visibility?
6. What is your log structure standard (keys, requestId, tenantId)? How do you prevent leaking raw meeting notes into logs?
7. How would you monitor worker health and backlog (queued jobs, retry rate, dead-letter rate) in both Local Mode and Azure Mode?
8. How would you define and implement SLOs for this system (e.g., “90% of notes processed within X seconds”)? What measurements do you need?
9. How would you implement alerting thresholds that are tenant-aware without paging on noisy tenants?
10. Where would you store and visualize traces in Azure (App Insights, Log Analytics) and what retention/cost model would you pick?

## 7. Progressive Delivery & Deployment Model

1. CI is present, but what is the intended CD model for the Azure reference (manual deploy, environment promotion, GitOps)? Why?
2. The feature-flag system allows header overrides in non-production but disables them in production. What is the threat model behind this, and what production override mechanism would you allow?
3. How would you implement a safe rollout of a new extraction provider (e.g., LLM-based) using the existing flag framework?
4. How do you plan for rollback if a new extraction provider degrades task quality or increases failures? What state would be left behind?
5. What deployment strategy would you choose for worker changes vs API changes (independent vs coupled releases) and why?
6. How would you handle database/schema migrations in Azure Mode while keeping Local Mode “zero infra”?
7. What environments would you define (dev/test/stage/prod) and how would you keep feature flag defaults consistent across them?
8. How do you ensure E2E smoke tests run against deployed Azure environments, not just CI local runs? What is the gating policy?
9. How would you handle “breaking changes” to audit event shape or task schema in a way that preserves backward compatibility?
10. What is the minimum viable “release safety” package you’d add (health probes, canary, blue/green) and where would it live?

## 8. Governance & Risk (AI-specific if relevant)

1. Today extraction is deterministic rules. If you add an LLM provider behind the provider interface, what governance controls must be added (prompt/versioning, evaluations, regressions, approvals)?
2. What is the data classification of meeting notes, and what privacy posture do you need (retention, access logging, tenant-level encryption keys, regional residency)?
3. If an LLM provider is introduced, what is your policy on sending raw meeting notes off-box (PII/PHI/HR content)? What redaction or minimization would you require?
4. How do you prevent prompt injection or malicious meeting notes from causing unsafe outputs (exfiltration, tool misuse) if the extractor becomes agentic?
5. How would you define “task quality” and measure it over time (precision/recall, human acceptance rate, false-positive cost)?
6. What human-in-the-loop governance is needed for extracted tasks (approval/rejection exists). What additional controls are needed for high-risk tasks (HR, compliance)?
7. Audit events exist. Are they sufficient for governance (who submitted, who approved/rejected, who changed titles/owners)? What would you add?
8. What is the policy for role changes (admin grants) and how do you prevent privilege escalation via membership endpoints?
9. How do you model tenant consent and terms for AI processing (opt-in, per-tenant configuration, data usage restrictions)?
10. If a tenant requests an export of “all AI decisions” (why a task was suggested), what provenance can you provide given rules-based vs LLM-based extraction?

## 9. Scalability & Performance

1. Scenario: one tenant submits 10k notes/day. Where are the bottlenecks in the current architecture (API throughput, store writes, worker polling), and how would you scale each layer?
2. Scenario: multi-tenant load where one tenant becomes “hot”. How does partitioning by tenantId help, and when does it become a problem (hot partition)?
3. Scenario: a single note contains 200k characters. How do you handle payload limits (API, store, UI), and what happens to telemetry volume?
4. Scenario: two workers run concurrently. What data corruption or double-processing risks exist in the LocalJsonStore approach?
5. Scenario: worker crashes after locking a job and setting note status to processing. How does the job get retried? Is there a lock timeout / requeue mechanism?
6. Scenario: extraction provider is slow (30s per note). How do you handle backpressure, timeouts, and fairness across tenants?
7. Scenario: you migrate to Cosmos DB. How do you design queries to avoid cross-partition fan-out while still supporting “list tasks by status” and “list notes by tenant” efficiently?
8. Scenario: you need “search notes” (full-text) per tenant. What services or indexing strategies would you add, and how would you keep tenant isolation?
9. Scenario: you introduce real-time updates in the web UI. Would you use polling, WebSockets, SSE, or SignalR—and how do you secure it per tenant?
10. Scenario: you add analytics dashboards. How do you avoid cross-tenant aggregations in the operational store while still enabling reporting?

## 10. Cost & Operational Tradeoffs

1. In Azure Mode, what are the top 3 cost drivers (Cosmos RU, App Insights ingestion, Functions execution, Key Vault ops), and how would you bound each?
2. What sampling and attribute minimization would you implement to keep tracing useful but affordable?
3. Static Web Apps vs App Service vs Container Apps for the SPA: what are the cost inflection points and operational overhead differences?
4. How would you size Cosmos RU for a tenant-partitioned write-heavy workload, and what is your strategy for autoscale vs provisioned RU?
5. What is your retention strategy for audit events and traces (by tenant), and how do you prevent retention from becoming an unbounded cost?
6. If you add an LLM provider, what is your cost-control plan (token budgets, caching, batching, fallback to rules)?
7. What operational tasks would you automate first (seed, backups, restores, reprocessing jobs) and why?
8. How do you decide which features belong in the “reference” skeleton vs being omitted to avoid misleading cost expectations?

## 11. Consulting & Leadership Framing

1. Explain this architecture to a CTO in 3 minutes: what is it, why does it exist, and what risks does it explicitly mitigate?
2. Explain to a security reviewer why “dev header auth” exists and how you guarantee it cannot exist in production.
3. If a customer insists on Postgres in Azure, how do you adapt the architecture without breaking the tenant isolation model?
4. If a customer insists on Cosmos but wants cross-tenant reporting, how do you propose a two-store pattern (operational vs analytics) and what tradeoffs do you highlight?
5. How do you justify the rules-based extractor as the default in a world that expects LLMs? What narrative do you use about determinism and governance?
6. Describe your “minimum set of artifacts” for an architecture review: ADRs, diagrams, threat model, SLOs, runbooks—what’s already here and what’s missing?
7. How do you communicate the difference between a “reference implementation” and “production-ready system” without undermining stakeholder confidence?
8. A stakeholder asks: “Can we ship this as-is?” What is your crisp, non-alarmist answer and what proof points do you offer?
9. How would you run an incident review for “tasks missing for a tenant” given current telemetry and audit events?
10. What is your strategy for onboarding engineers to this repo in a week—what do they need to understand first to avoid breaking tenant isolation?

## 12. Hard Panel Questions

1. Prove (with code-level reasoning) that a user from tenant B cannot modify or export tasks from tenant A. Where is the weakest link?
2. Show how two worker instances could double-process the same job today. What would the failure look like and how would you detect it?
3. The LocalJsonStore writes the entire JSON file on every mutation. What is the worst-case performance and corruption risk, and why is this still acceptable in a demo?
4. The API’s dev fallback selects an admin user if headers are missing (non-production modes). What if the store contains multiple tenants—how do you ensure you don’t accidentally cross tenants in dev fallback?
5. The delete feature returns `404` when disabled. How could this harm operability (support teams, debugging) and how would you mitigate without weakening the concealment goal?
6. Your telemetry includes tenantId and userId attributes. Explain how you prevent this from violating privacy/security policies in production.
7. If an attacker can control meeting note content, what is the worst they can do to the system today (rules-based) and in the future (LLM-based)?
8. You rely on application-level uniqueness and constraints. Name three integrity bugs that are easy to introduce in a document model and how you’d prevent them.
9. Why should anyone trust audit events stored in the same operational store as the mutable entities? What is your tamper-resistance strategy?
10. If you had to pass SOC 2 / ISO 27001 requirements for this system, which parts of the repo would immediately fail the audit and why?

---

# Learning Gap Signals

- Candidate must deeply understand: multi-tenant isolation patterns, partitioning-by-tenant (Cosmos), idempotent job processing, eventual consistency, and RBAC enforcement at API boundaries.
- Must be comfortable reading and reasoning about: Fastify hooks + injection testing, file-backed persistence failure modes, and retry semantics.
- Must understand observability fundamentals: OpenTelemetry tracing, sampling/cost tradeoffs, attribute cardinality, and sensitive-data handling.
- Must understand DevSecOps basics: CI quality gates, dependency/lockfile integrity, secret management via Key Vault + Managed Identity, and least-privilege RBAC.
- Areas that appear weak or under-explained: production-grade concurrency/locking (LocalJsonStore), job lock timeouts/requeue strategy, formal interface boundaries for store adapters, and explicit SLO/alerting definitions.
- Areas that could trigger skepticism: presence of docker-compose Postgres while Local Mode uses JSON store, reliance on dev header auth (even if documented), and absence of explicit threat model / SBOM / dependency scanning.
- Missing artifacts that a rigorous panel may expect: threat model + data flow diagram, explicit SLOs and runbooks, rollback strategy for Azure deployments, and AI governance artifacts (evaluation datasets, prompt/version registry) if an LLM provider is added.
