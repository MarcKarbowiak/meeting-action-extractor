import { LocalFileStore } from './store.js';

const DEMO_TENANT_ID = 'tenant-demo';
const ADMIN_USER_ID = 'user-admin-demo';
const MEMBER_USER_ID = 'user-member-demo';
const SAMPLE_NOTE_ID = 'note-demo-1';
const SAMPLE_JOB_ID = 'job-demo-1';

const seed = (): void => {
  const store = new LocalFileStore();

  store.upsertTenant({
    id: DEMO_TENANT_ID,
    name: 'Demo Tenant',
  });

  store.upsertUser({
    id: ADMIN_USER_ID,
    email: 'admin@demo.local',
  });

  store.upsertUser({
    id: MEMBER_USER_ID,
    email: 'member@demo.local',
  });

  store.upsertMembership({
    tenantId: DEMO_TENANT_ID,
    userId: ADMIN_USER_ID,
    role: 'admin',
  });

  store.upsertMembership({
    tenantId: DEMO_TENANT_ID,
    userId: MEMBER_USER_ID,
    role: 'member',
  });

  const now = new Date().toISOString();
  store.upsertNote({
    id: SAMPLE_NOTE_ID,
    tenantId: DEMO_TENANT_ID,
    content: 'Discuss Q1 roadmap and assign follow-up tasks to team leads.',
    createdAt: now,
  });

  store.upsertJob({
    id: SAMPLE_JOB_ID,
    tenantId: DEMO_TENANT_ID,
    noteId: SAMPLE_NOTE_ID,
    status: 'queued',
    createdAt: now,
  });

  console.log('Seed complete: Demo tenant, users, memberships, sample note, and queued job are present.');
};

seed();
