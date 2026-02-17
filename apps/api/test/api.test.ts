import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { getDefaultDataDir, LocalJsonStore } from '@meeting-action-extractor/db';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildApiApp } from '../src/app.js';

const TEST_DATA_DIR = join(getDefaultDataDir(), 'api-test');

const setupStore = (): LocalJsonStore => {
  rmSync(TEST_DATA_DIR, { force: true, recursive: true });
  const store = new LocalJsonStore(TEST_DATA_DIR);

  store.upsertTenant({ id: 'tenant-a', name: 'Tenant A' });
  store.upsertTenant({ id: 'tenant-b', name: 'Tenant B' });

  store.upsertUser({ id: 'user-admin-a', email: 'admin-a@demo.local', displayName: 'admin-a' });
  store.upsertUser({ id: 'user-member-a', email: 'member-a@demo.local', displayName: 'member-a' });
  store.upsertUser({ id: 'user-reader-a', email: 'reader-a@demo.local', displayName: 'reader-a' });
  store.upsertUser({ id: 'user-admin-b', email: 'admin-b@demo.local', displayName: 'admin-b' });

  store.upsertMembership({ tenantId: 'tenant-a', userId: 'user-admin-a', role: 'admin' });
  store.upsertMembership({ tenantId: 'tenant-a', userId: 'user-member-a', role: 'member' });
  store.upsertMembership({ tenantId: 'tenant-a', userId: 'user-reader-a', role: 'reader' });
  store.upsertMembership({ tenantId: 'tenant-b', userId: 'user-admin-b', role: 'admin' });

  return store;
};

const authHeaders = (params: {
  tenantId: string;
  userId: string;
  email: string;
  roles: string;
  featureFlags?: string;
}): Record<string, string> => {
  const headers = {
    'x-tenant-id': params.tenantId,
    'x-user-id': params.userId,
    'x-user-email': params.email,
    'x-user-roles': params.roles,
  };

  if (params.featureFlags) {
    return {
      ...headers,
      'x-feature-flags': params.featureFlags,
    };
  }

  return headers;
};

describe('API integration', () => {
  beforeEach(() => {
    rmSync(TEST_DATA_DIR, { force: true, recursive: true });
  });

  it('rejects missing tenant headers in production mode', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'production', store });

    const response = await app.inject({
      method: 'GET',
      url: '/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing required auth headers.',
      },
    });

    await app.close();
  });

  it('enforces RBAC for reader and allows admin membership changes', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const readerPost = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-reader-a',
        email: 'reader-a@demo.local',
        roles: 'reader',
      }),
      payload: {
        title: 'Reader write attempt',
        rawText: 'Should fail for reader.',
      },
    });

    expect(readerPost.statusCode).toBe(403);

    const adminAddMember = await app.inject({
      method: 'POST',
      url: '/tenants/tenant-a/members',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-admin-a',
        email: 'admin-a@demo.local',
        roles: 'admin',
      }),
      payload: {
        email: 'new-member@demo.local',
        role: 'member',
      },
    });

    expect(adminAddMember.statusCode).toBe(200);
    const body = adminAddMember.json();
    expect(body.member.email).toBe('new-member@demo.local');
    expect(body.member.role).toBe('member');

    await app.close();
  });

  it('enforces tenant isolation for note reads', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const created = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
      payload: {
        title: 'Tenant A note',
        rawText: 'Private note for tenant A',
      },
    });

    expect(created.statusCode).toBe(200);
    const createdBody = created.json();
    const noteId = createdBody.note.id as string;

    const crossTenantRead = await app.inject({
      method: 'GET',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-b',
        userId: 'user-admin-b',
        email: 'admin-b@demo.local',
        roles: 'admin',
      }),
    });

    expect(crossTenantRead.statusCode).toBe(404);

    await app.close();
  });

  it('returns CSV export with expected headers', async () => {
    const store = setupStore();
    const note = store.createNote({
      tenantId: 'tenant-a',
      title: 'Export note',
      rawText: 'Will export approved task.',
      createdBy: 'user-member-a',
    });

    store.createTask({
      tenantId: 'tenant-a',
      noteId: note.id,
      title: 'Follow up with finance',
      owner: 'Alicia',
      dueDate: '2026-02-20',
      status: 'approved',
      confidence: 0.95,
    });

    const app = buildApiApp({ mode: 'test', store });

    const exportResponse = await app.inject({
      method: 'GET',
      url: '/tasks/export.csv?status=approved',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
    });

    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(exportResponse.headers['content-disposition']).toContain('filename="tasks.csv"');
    expect(exportResponse.body).toContain('id,title,owner,dueDate,status,confidence,notesId,createdAt');
    expect(exportResponse.body).toContain('Follow up with finance');

    await app.close();
  });

  it('returns 404 for delete when notes.allowDelete feature flag is disabled', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const created = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
      payload: {
        title: 'Delete me',
        rawText: 'ACTION: delete test note',
      },
    });

    expect(created.statusCode).toBe(200);
    const noteId = created.json().note.id as string;

    const crossTenantDelete = await app.inject({
      method: 'DELETE',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-b',
        userId: 'user-admin-b',
        email: 'admin-b@demo.local',
        roles: 'admin',
      }),
    });

    expect(crossTenantDelete.statusCode).toBe(404);

    const ownTenantDelete = await app.inject({
      method: 'DELETE',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-admin-a',
        email: 'admin-a@demo.local',
        roles: 'admin',
      }),
    });

    expect(ownTenantDelete.statusCode).toBe(404);

    await app.close();
  });

  it('returns 403 for delete when flag enabled but requester is not admin', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const created = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
      payload: {
        title: 'Delete me',
        rawText: 'ACTION: delete test note',
      },
    });

    expect(created.statusCode).toBe(200);
    const noteId = created.json().note.id as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
        featureFlags: 'notes.allowDelete=true',
      }),
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it('deletes note, tasks, and jobs when flag enabled and requester is admin', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const created = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
      payload: {
        title: 'Delete me',
        rawText: 'ACTION: delete test note',
      },
    });

    expect(created.statusCode).toBe(200);
    const noteId = created.json().note.id as string;
    const jobId = created.json().job.id as string;

    store.createTask({
      tenantId: 'tenant-a',
      noteId,
      title: 'Task to remove',
      status: 'suggested',
      confidence: 0.5,
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-admin-a',
        email: 'admin-a@demo.local',
        roles: 'admin',
        featureFlags: 'notes.allowDelete=true',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deleted: true,
      noteId,
    });

    expect(store.getNoteByIdForTenant('tenant-a', noteId)).toBeUndefined();
    expect(store.listTasksByNote('tenant-a', noteId)).toHaveLength(0);
    expect(store.getJobById(jobId)).toBeUndefined();

    const deletedAudit = store
      .getSnapshot()
      .auditEvents.find((event) => event.action === 'note_deleted' && event.entityId === noteId);
    expect(deletedAudit).toBeDefined();

    await app.close();
  });

  it('blocks cross-tenant delete attempts with 404 when flag enabled and requester is admin', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const created = await app.inject({
      method: 'POST',
      url: '/notes',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
      payload: {
        title: 'Delete with json header',
        rawText: 'ACTION: delete',
      },
    });

    expect(created.statusCode).toBe(200);
    const noteId = created.json().note.id as string;

    const response = await app.inject({
      method: 'DELETE',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-b',
        userId: 'user-admin-b',
        email: 'admin-b@demo.local',
        roles: 'admin',
        featureFlags: 'notes.allowDelete=true',
      }),
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('enforces tenant isolation for tasks list', async () => {
    const store = setupStore();

    const tenantANote = store.createNote({
      tenantId: 'tenant-a',
      title: 'Tenant A note',
      rawText: 'A',
      createdBy: 'user-member-a',
    });
    store.createTask({
      tenantId: 'tenant-a',
      noteId: tenantANote.id,
      title: 'Tenant A task',
      owner: 'Owner A',
      status: 'suggested',
      confidence: 0.5,
    });

    const tenantBNote = store.createNote({
      tenantId: 'tenant-b',
      title: 'Tenant B note',
      rawText: 'B',
      createdBy: 'user-admin-b',
    });
    store.createTask({
      tenantId: 'tenant-b',
      noteId: tenantBNote.id,
      title: 'Tenant B task',
      owner: 'Owner B',
      status: 'suggested',
      confidence: 0.5,
    });

    const app = buildApiApp({ mode: 'test', store });

    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe('Tenant A task');

    await app.close();
  });

  it('enforces RBAC and tenant isolation for task updates', async () => {
    const store = setupStore();

    const note = store.createNote({
      tenantId: 'tenant-a',
      title: 'Update task note',
      rawText: 'A',
      createdBy: 'user-member-a',
    });

    const task = store.createTask({
      tenantId: 'tenant-a',
      noteId: note.id,
      title: 'Task to update',
      status: 'suggested',
      confidence: 0.5,
    });

    const app = buildApiApp({ mode: 'test', store });

    const readerPatch = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.id}`,
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-reader-a',
        email: 'reader-a@demo.local',
        roles: 'reader',
      }),
      payload: {
        status: 'approved',
      },
    });

    expect(readerPatch.statusCode).toBe(403);

    const crossTenantPatch = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.id}`,
      headers: authHeaders({
        tenantId: 'tenant-b',
        userId: 'user-admin-b',
        email: 'admin-b@demo.local',
        roles: 'admin',
      }),
      payload: {
        status: 'approved',
      },
    });

    expect(crossTenantPatch.statusCode).toBe(404);

    const ownTenantPatch = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.id}`,
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
      payload: {
        status: 'approved',
      },
    });

    expect(ownTenantPatch.statusCode).toBe(200);
    expect(ownTenantPatch.json().task.status).toBe('approved');

    await app.close();
  });

  it('enforces RBAC and tenant scope for members list', async () => {
    const store = setupStore();
    const app = buildApiApp({ mode: 'test', store });

    const memberDenied = await app.inject({
      method: 'GET',
      url: '/tenants/tenant-a/members',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
    });

    expect(memberDenied.statusCode).toBe(403);

    const crossTenantDenied = await app.inject({
      method: 'GET',
      url: '/tenants/tenant-a/members',
      headers: authHeaders({
        tenantId: 'tenant-b',
        userId: 'user-admin-b',
        email: 'admin-b@demo.local',
        roles: 'admin',
      }),
    });

    expect(crossTenantDenied.statusCode).toBe(404);

    const ownTenantAllowed = await app.inject({
      method: 'GET',
      url: '/tenants/tenant-a/members',
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-admin-a',
        email: 'admin-a@demo.local',
        roles: 'admin',
      }),
    });

    expect(ownTenantAllowed.statusCode).toBe(200);
    const body = ownTenantAllowed.json();
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.members.some((member: { userId: string }) => member.userId === 'user-admin-a')).toBe(true);

    await app.close();
  });
});
