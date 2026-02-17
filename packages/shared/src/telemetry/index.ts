import { context, trace, type Attributes, type Tracer, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOnSampler,
  ConsoleSpanExporter,
  ParentBasedSampler,
  type Sampler,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export type TelemetryServiceName = 'api' | 'worker' | 'web';

export type InitTelemetryOptions = {
  serviceName: TelemetryServiceName;
};

export type SpanAttributeInput = {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  jobId?: string;
  noteId?: string;
  deploymentEnvironment?: string;
};

const parseResourceAttributes = (value?: string): Attributes => {
  if (!value) {
    return {};
  }

  const attributes: Attributes = {};
  const pairs = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=');
    const rawValue = rest.join('=').trim();
    if (!key || rawValue.length === 0) {
      continue;
    }

    attributes[key.trim()] = rawValue;
  }

  return attributes;
};

const resolveSampler = (value?: string): Sampler => {
  const samplerName = (value ?? 'parentbased_always_on').toLowerCase();

  if (samplerName === 'always_on') {
    return new AlwaysOnSampler();
  }

  return new ParentBasedSampler({
    root: new AlwaysOnSampler(),
  });
};

const resolveSpanProcessor = (): SimpleSpanProcessor => {
  const exporterType = (process.env.OTEL_EXPORTER ?? '').toLowerCase();
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (exporterType === 'otlp' || endpoint) {
    return new SimpleSpanProcessor(
      new OTLPTraceExporter(
        endpoint
          ? {
              url: endpoint,
            }
          : undefined,
      ),
    );
  }

  return new SimpleSpanProcessor(new ConsoleSpanExporter());
};

export const buildSpanAttributes = (input: SpanAttributeInput): Attributes => {
  const attributes: Attributes = {};

  if (input.deploymentEnvironment) {
    attributes['deployment.environment'] = input.deploymentEnvironment;
  }

  if (input.tenantId) {
    attributes.tenantId = input.tenantId;
  }

  if (input.userId) {
    attributes.userId = input.userId;
  }

  if (input.requestId) {
    attributes.requestId = input.requestId;
  }

  if (input.jobId) {
    attributes.jobId = input.jobId;
  }

  if (input.noteId) {
    attributes.noteId = input.noteId;
  }

  return attributes;
};

export const initTelemetry = async (options: InitTelemetryOptions): Promise<{ shutdown: () => Promise<void> }> => {
  const environment = process.env.NODE_ENV ?? 'local';

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      'deployment.environment': environment,
      ...parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES),
    }),
    sampler: resolveSampler(process.env.OTEL_TRACES_SAMPLER),
    spanProcessors: [resolveSpanProcessor()],
  });

  await sdk.start();

  return {
    shutdown: async () => {
      await sdk.shutdown();
    },
  };
};

export const getTracer = (serviceName: TelemetryServiceName): Tracer => {
  return trace.getTracer(`meeting-action-extractor.${serviceName}`);
};

export const runWithSpan = async <T>(params: {
  tracer: Tracer;
  name: string;
  attributes?: Attributes;
  run: () => T | Promise<T>;
}): Promise<T> => {
  const { tracer, name, attributes, run } = params;

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await run();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
      }
      span.setStatus({
        code: SpanStatusCode.ERROR,
      });
      throw error;
    } finally {
      span.end();
    }
  });
};

export const runWithChildSpan = async <T>(params: {
  tracer: Tracer;
  parentSpan: Parameters<typeof trace.setSpan>[1];
  name: string;
  attributes?: Attributes;
  run: () => T | Promise<T>;
}): Promise<T> => {
  const scopedContext = trace.setSpan(context.active(), params.parentSpan);

  return context.with(scopedContext, async () => {
    return runWithSpan({
      tracer: params.tracer,
      name: params.name,
      attributes: params.attributes,
      run: params.run,
    });
  });
};
