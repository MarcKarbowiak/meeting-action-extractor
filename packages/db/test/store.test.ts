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

  it('deletes a note and cascades related tasks and jobs (tenant-scoped)', () => {
    const store = new LocalFileStore(TEST_DATA_DIR);

    const noteA = store.createNote('tenant-a', 'Note A');
    const jobA = store.enqueueJob('tenant-a', noteA.id);
    const taskA1 = store.createTask({
      tenantId: 'tenant-a',
      noteId: noteA.id,
      title: 'Task A1',
      status: 'suggested',
      confidence: 0.5,
    });

    const noteB = store.createNote('tenant-b', 'Note B');
    const jobB = store.enqueueJob('tenant-b', noteB.id);
    const taskB1 = store.createTask({
      tenantId: 'tenant-b',
      noteId: noteB.id,
      title: 'Task B1',
      status: 'suggested',
      confidence: 0.5,
    });

    expect(store.getNoteByIdForTenant('tenant-a', noteA.id)).toBeDefined();
    expect(store.getJobById(jobA.id)).toBeDefined();
    expect(store.listTasksByNote('tenant-a', noteA.id).some((task) => task.id === taskA1.id)).toBe(true);

    const deleted = store.deleteNoteForTenant('tenant-a', noteA.id);
    expect(deleted).toBe(true);

    expect(store.getNoteByIdForTenant('tenant-a', noteA.id)).toBeUndefined();
    expect(store.listTasksByNote('tenant-a', noteA.id)).toHaveLength(0);
    expect(store.getJobById(jobA.id)).toBeUndefined();

    // Other tenant remains intact.
    expect(store.getNoteByIdForTenant('tenant-b', noteB.id)).toBeDefined();
    expect(store.getJobById(jobB.id)).toBeDefined();
    expect(store.listTasksByNote('tenant-b', noteB.id).some((task) => task.id === taskB1.id)).toBe(true);
  });
});
