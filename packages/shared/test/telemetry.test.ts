import { describe, expect, it } from 'vitest';

import { buildSpanAttributes, initTelemetry } from '../src/telemetry/index.js';

describe('telemetry', () => {
  it('initTelemetry does not throw when OTLP endpoint is missing', async () => {
    const previousExporter = process.env.OTEL_EXPORTER;
    const previousEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    process.env.OTEL_EXPORTER = 'console';

    const telemetry = await initTelemetry({ serviceName: 'api' });
    await telemetry.shutdown();

    process.env.OTEL_EXPORTER = previousExporter;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previousEndpoint;

    expect(true).toBe(true);
  });

  it('buildSpanAttributes includes tenantId when provided', () => {
    const attrs = buildSpanAttributes({
      tenantId: 'tenant-demo',
      requestId: 'req-1',
    });

    expect(attrs.tenantId).toBe('tenant-demo');
    expect(attrs.requestId).toBe('req-1');
  });
});
