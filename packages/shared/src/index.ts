export type TenantScoped = {
  tenantId: string;
};

export {
  type FlagContext,
  type FlagKey,
  type FlagValue,
  getFlag,
  parseEnvFlags,
  parseHeaderFlags,
} from './feature-flags/index.js';

export {
  type InitTelemetryOptions,
  type SpanAttributeInput,
  type TelemetryServiceName,
  buildSpanAttributes,
  getTracer,
  initTelemetry,
  runWithChildSpan,
  runWithSpan,
} from './telemetry/index.js';
