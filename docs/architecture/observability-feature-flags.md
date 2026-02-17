# Observability and Feature Flags (Phase 8)

This document defines the Local Mode implementation for tracing and runtime feature flag evaluation.

## OpenTelemetry Tracing

### Services

Tracing is initialized in:

- `apps/api`
- `apps/worker`

Initialization uses `packages/shared/src/telemetry/initTelemetry`.

### Export Strategy

Environment-based behavior:

- `OTEL_EXPORTER=otlp` or `OTEL_EXPORTER_OTLP_ENDPOINT` set → OTLP HTTP exporter
- Otherwise → Console span exporter

Default local sampler is `parentbased_always_on`.

### Core Span Attributes

When available, spans include:

- `tenantId`
- `userId`
- `requestId`
- `jobId`
- `noteId`
- `deployment.environment`

Resource attributes include `service.name` and `deployment.environment`.

Raw transcript text is not attached to span attributes.

## API Trace Flow

Each route handler executes inside a request span named by route pattern:

- `GET /notes`
- `POST /notes`
- `DELETE /notes/:id`

Store and audit operations are traced as child spans:

- `store.notes.create`
- `store.jobs.enqueue`
- `store.tasks.list`
- `store.audit.write`

Errors are recorded with `recordException` and span error status.

## Worker Trace Flow

Each locked job is traced under:

- `worker.processJob`

Deterministic child span sequence includes:

- `store.jobs.lock`
- `store.notes.get`
- `extractor.rules.extract`
- `store.tasks.upsert`
- `store.jobs.complete` or `store.jobs.fail`
- `store.audit.write`

## Feature Flag Evaluation

Shared implementation lives in `packages/shared/src/feature-flags`.

### Supported Flags

- `telemetry.enabled` (default `true`)
- `extractor.provider` (default `rules`)
- `notes.allowDelete` (default `false`)
- `ui.devContextPanel` (default `true` in local)

### Resolution Priority

1. Header override (`x-feature-flags`) in non-production mode
2. Environment (`FEATURE_*`)
3. Default values

Header overrides are ignored when `NODE_ENV=production`.

### Controlled Delete Rule

`DELETE /notes/:id` is enabled only when `notes.allowDelete=true` and requester has `admin` role.

If delete flag is disabled, API returns `404`.
