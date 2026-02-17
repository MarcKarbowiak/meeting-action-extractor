import { describe, expect, it } from 'vitest';

import { getFlag, parseEnvFlags, parseHeaderFlags } from '../src/feature-flags/index.js';

describe('feature flags', () => {
  it('parses env flags correctly', () => {
    const flags = parseEnvFlags({
      FEATURE_NOTES_ALLOWDELETE: 'true',
      FEATURE_TELEMETRY_ENABLED: 'false',
      FEATURE_EXTRACTOR_PROVIDER: 'rules',
      FEATURE_UI_DEVCONTEXTPANEL: 'true',
    });

    expect(flags['notes.allowDelete']).toBe(true);
    expect(flags['telemetry.enabled']).toBe(false);
    expect(flags['extractor.provider']).toBe('rules');
    expect(flags['ui.devContextPanel']).toBe(true);
  });

  it('parses header flags correctly', () => {
    const flags = parseHeaderFlags('notes.allowDelete=true,telemetry.enabled=false,extractor.provider=rules');

    expect(flags['notes.allowDelete']).toBe(true);
    expect(flags['telemetry.enabled']).toBe(false);
    expect(flags['extractor.provider']).toBe('rules');
  });

  it('ignores header overrides in production mode', () => {
    const value = getFlag('notes.allowDelete', {
      environment: 'production',
      headerFlags: {
        'notes.allowDelete': true,
      },
      envFlags: {
        'notes.allowDelete': false,
      },
    });

    expect(value).toBe(false);
  });

  it('applies defaults when no overrides are set', () => {
    expect(getFlag('telemetry.enabled', { environment: 'local', envFlags: {}, headerFlags: {} })).toBe(true);
    expect(getFlag('extractor.provider', { environment: 'local', envFlags: {}, headerFlags: {} })).toBe('rules');
    expect(getFlag('notes.allowDelete', { environment: 'local', envFlags: {}, headerFlags: {} })).toBe(false);
    expect(getFlag('ui.devContextPanel', { environment: 'local', envFlags: {}, headerFlags: {} })).toBe(true);
  });
});
