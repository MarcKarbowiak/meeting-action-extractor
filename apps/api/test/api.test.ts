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
}): Record<string, string> => {
  return {
    'x-tenant-id': params.tenantId,
    'x-user-id': params.userId,
    'x-user-email': params.email,
    'x-user-roles': params.roles,
  };
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

  it('allows deleting a note for the same tenant and blocks cross-tenant delete', async () => {
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
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
    });

    expect(ownTenantDelete.statusCode).toBe(200);
    expect(ownTenantDelete.json()).toEqual({
      deleted: true,
      noteId,
    });

    const readDeleted = await app.inject({
      method: 'GET',
      url: `/notes/${noteId}`,
      headers: authHeaders({
        tenantId: 'tenant-a',
        userId: 'user-member-a',
        email: 'member-a@demo.local',
        roles: 'member',
      }),
    });

    expect(readDeleted.statusCode).toBe(404);

    await app.close();
  });

  it('accepts DELETE with application/json header and empty body', async () => {
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
      headers: {
        ...authHeaders({
          tenantId: 'tenant-a',
          userId: 'user-member-a',
          email: 'member-a@demo.local',
          roles: 'member',
        }),
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
