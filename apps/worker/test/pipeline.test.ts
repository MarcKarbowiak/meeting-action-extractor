import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { getDefaultDataDir, LocalJsonStore } from '@meeting-action-extractor/db';
import type { IExtractionProvider } from '@meeting-action-extractor/extractor';
import { beforeEach, describe, expect, it } from 'vitest';

import { runOnce } from '../src/worker.js';

const TEST_DATA_DIR = join(getDefaultDataDir(), 'worker-test');

const seedDemo = (store: LocalJsonStore): { tenantId: string; userId: string } => {
  const tenantId = 'tenant-demo';
  const userId = 'user-member-demo';

  store.upsertTenant({ id: tenantId, name: 'Demo Tenant' });
  store.upsertUser({
    id: userId,
    email: 'member@demo.local',
    displayName: 'member',
  });
  store.upsertMembership({
    tenantId,
    userId,
    role: 'member',
  });

  return { tenantId, userId };
};

describe('worker pipeline', () => {
  beforeEach(() => {
    rmSync(TEST_DATA_DIR, { force: true, recursive: true });
  });

  it('processes queued job end-to-end and writes suggested tasks + audits', async () => {
    const store = new LocalJsonStore(TEST_DATA_DIR);
    const { tenantId, userId } = seedDemo(store);

    const note = store.createNote({
      tenantId,
      title: 'Planning',
      rawText: 'ACTION: Finalize plan Owner: Priya due 2026-03-01\n- review budget with finance',
      createdBy: userId,
    });
    const job = store.enqueueJob(tenantId, note.id);

    const processed = await runOnce({ store, maxJobs: 5 });
    expect(processed).toBe(1);

    const nextJob = store.getJobById(job.id);
    const nextNote = store.getNoteByIdForTenant(tenantId, note.id);
    const tasks = store.listTasksByNote(tenantId, note.id);
    const audits = store
      .getSnapshot()
      .auditEvents.filter((audit) => audit.tenantId === tenantId && audit.entityId === note.id);

    expect(nextJob?.status).toBe('done');
    expect(nextNote?.status).toBe('ready');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((task) => task.title.toLowerCase().includes('finalize plan'))).toBe(true);
    expect(audits.some((audit) => audit.action === 'job_completed')).toBe(true);
    expect(audits.some((audit) => audit.action === 'tasks_suggested_count')).toBe(true);
  });

  it('retries failed jobs and marks job/note failed on third attempt', async () => {
    const store = new LocalJsonStore(TEST_DATA_DIR);
    const { tenantId, userId } = seedDemo(store);

    const note = store.createNote({
      tenantId,
      title: 'Failure scenario',
      rawText: 'ACTION: this will fail extraction',
      createdBy: userId,
    });
    const job = store.enqueueJob(tenantId, note.id);

    const failingProvider: IExtractionProvider = {
      extractTasks() {
        throw new Error('forced extraction failure');
      },
    };

    await runOnce({ store, provider: failingProvider, maxJobs: 5 });
    await runOnce({ store, provider: failingProvider, maxJobs: 5 });
    await runOnce({ store, provider: failingProvider, maxJobs: 5 });

    const finalJob = store.getJobById(job.id);
    const finalNote = store.getNoteByIdForTenant(tenantId, note.id);
    const failedAudit = store
      .getSnapshot()
      .auditEvents.find((audit) => audit.action === 'job_failed' && audit.entityId === note.id);

    expect(finalJob?.attempts).toBe(3);
    expect(finalJob?.status).toBe('failed');
    expect(finalNote?.status).toBe('failed');
    expect(failedAudit).toBeDefined();
  });
});
