import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { getDefaultDataDir, LocalFileStore } from '../src/store.js';

const TEST_DATA_DIR = join(getDefaultDataDir(), 'db-test');

describe('LocalFileStore', () => {
  beforeEach(() => {
    rmSync(TEST_DATA_DIR, { force: true, recursive: true });
  });

  it('enforces tenant isolation for note reads', () => {
    const store = new LocalFileStore(TEST_DATA_DIR);

    store.upsertTenant({ id: 'tenant-a', name: 'Tenant A' });
    store.upsertTenant({ id: 'tenant-b', name: 'Tenant B' });

    const note = store.createNote('tenant-a', 'Action item for tenant A only');

    expect(store.getNoteByIdForTenant('tenant-a', note.id)).toBeDefined();
    expect(store.getNoteByIdForTenant('tenant-b', note.id)).toBeUndefined();
    expect(store.listNotesByTenant('tenant-b')).toHaveLength(0);
  });

  it('prevents duplicate memberships for same tenant and user', () => {
    const store = new LocalFileStore(TEST_DATA_DIR);

    store.upsertTenant({ id: 'tenant-demo', name: 'Demo Tenant' });
    store.upsertUser({ id: 'user-1', email: 'member@demo.local' });

    store.addMembership({
      tenantId: 'tenant-demo',
      userId: 'user-1',
      role: 'member',
    });

    expect(() => {
      store.addMembership({
        tenantId: 'tenant-demo',
        userId: 'user-1',
        role: 'member',
      });
    }).toThrowError(/already exists/i);
  });

  it('locks a queued job only once', () => {
    const store = new LocalFileStore(TEST_DATA_DIR);

    store.upsertTenant({ id: 'tenant-demo', name: 'Demo Tenant' });
    const note = store.createNote('tenant-demo', 'Extract these tasks');
    store.enqueueJob('tenant-demo', note.id);

    const firstLock = store.lockNextJob();
    const secondLock = store.lockNextJob();

    expect(firstLock).toBeDefined();
    expect(firstLock?.status).toBe('processing');
    expect(secondLock).toBeUndefined();
  });
});
