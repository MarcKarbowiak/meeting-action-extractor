export type FlagKey =
  | 'telemetry.enabled'
  | 'extractor.provider'
  | 'notes.allowDelete'
  | 'ui.devContextPanel';

export type FlagValue = boolean | string;

export type FlagContext = {
  tenantId?: string;
  userId?: string;
  roles?: string[];
  environment?: string;
  headerFlags?: Partial<Record<FlagKey, FlagValue>>;
  envFlags?: Partial<Record<FlagKey, FlagValue>>;
};

const ENV_TO_FLAG: Record<string, FlagKey> = {
  FEATURE_TELEMETRY_ENABLED: 'telemetry.enabled',
  FEATURE_EXTRACTOR_PROVIDER: 'extractor.provider',
  FEATURE_NOTES_ALLOWDELETE: 'notes.allowDelete',
  FEATURE_UI_DEVCONTEXTPANEL: 'ui.devContextPanel',
};

const toBooleanIfPossible = (value: string): FlagValue => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return value.trim();
};

const isProductionEnv = (environment?: string): boolean => {
  return (environment ?? '').toLowerCase() === 'production';
};

export const parseEnvFlags = (
  env: Record<string, string | undefined> = (typeof process !== 'undefined' ? process.env : {}),
): Partial<Record<FlagKey, FlagValue>> => {
  const flags: Partial<Record<FlagKey, FlagValue>> = {};

  for (const [envKey, flagKey] of Object.entries(ENV_TO_FLAG)) {
    const rawValue = env[envKey];
    if (rawValue === undefined) {
      continue;
    }

    flags[flagKey] = toBooleanIfPossible(rawValue);
  }

  return flags;
};

export const parseHeaderFlags = (value?: string): Partial<Record<FlagKey, FlagValue>> => {
  if (!value) {
    return {};
  }

  const flags: Partial<Record<FlagKey, FlagValue>> = {};
  const pairs = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const pair of pairs) {
    const [rawKey, ...rawValueParts] = pair.split('=');
    const key = rawKey?.trim() as FlagKey | undefined;
    const valuePart = rawValueParts.join('=').trim();

    if (!key || valuePart.length === 0) {
      continue;
    }

    if (
      key !== 'telemetry.enabled' &&
      key !== 'extractor.provider' &&
      key !== 'notes.allowDelete' &&
      key !== 'ui.devContextPanel'
    ) {
      continue;
    }

    flags[key] = toBooleanIfPossible(valuePart);
  }

  return flags;
};

const defaultFlagValue = (flagKey: FlagKey, environment?: string): FlagValue => {
  if (flagKey === 'telemetry.enabled') {
    return true;
  }

  if (flagKey === 'extractor.provider') {
    return 'rules';
  }

  if (flagKey === 'notes.allowDelete') {
    return false;
  }

  if (flagKey === 'ui.devContextPanel') {
    return !isProductionEnv(environment);
  }

  return false;
};

const coerceFlagType = (flagKey: FlagKey, value: FlagValue): FlagValue => {
  if (flagKey === 'extractor.provider') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value).toLowerCase() === 'true';
};

export const getFlag = (flagKey: FlagKey, context: FlagContext = {}): FlagValue => {
  const environment = context.environment;
  const envFlags = context.envFlags ?? parseEnvFlags();
  const headerFlags = context.headerFlags ?? {};

  if (!isProductionEnv(environment) && headerFlags[flagKey] !== undefined) {
    return coerceFlagType(flagKey, headerFlags[flagKey] as FlagValue);
  }

  if (envFlags[flagKey] !== undefined) {
    return coerceFlagType(flagKey, envFlags[flagKey] as FlagValue);
  }

  return defaultFlagValue(flagKey, environment);
};
