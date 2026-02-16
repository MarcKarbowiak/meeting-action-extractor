import { LocalJsonStore } from './store.js';

const DEMO_TENANT_ID = 'tenant-demo';
const ADMIN_USER_ID = 'user-admin-demo';
const MEMBER_USER_ID = 'user-member-demo';
const SAMPLE_NOTE_ID = 'note-demo-1';
const SAMPLE_JOB_ID = 'job-demo-1';

const seed = (): void => {
  const store = new LocalJsonStore();

  store.upsertTenant({
    id: DEMO_TENANT_ID,
    name: 'Demo Tenant',
    createdAt: new Date().toISOString(),
  });

  store.upsertUser({
    id: ADMIN_USER_ID,
    email: 'admin@demo.local',
    displayName: 'admin',
    createdAt: new Date().toISOString(),
  });

  store.upsertUser({
    id: MEMBER_USER_ID,
    email: 'member@demo.local',
    displayName: 'member',
    createdAt: new Date().toISOString(),
  });

  store.upsertMembership({
    tenantId: DEMO_TENANT_ID,
    userId: ADMIN_USER_ID,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  store.upsertMembership({
    tenantId: DEMO_TENANT_ID,
    userId: MEMBER_USER_ID,
    role: 'member',
    createdAt: new Date().toISOString(),
  });

  const now = new Date().toISOString();
  store.upsertNote({
    id: SAMPLE_NOTE_ID,
    tenantId: DEMO_TENANT_ID,
    title: 'Q1 roadmap follow-up',
    rawText: 'Discuss Q1 roadmap and assign follow-up tasks to team leads.',
    status: 'submitted',
    createdBy: ADMIN_USER_ID,
    createdAt: now,
  });

  store.upsertJob({
    id: SAMPLE_JOB_ID,
    tenantId: DEMO_TENANT_ID,
    noteId: SAMPLE_NOTE_ID,
    status: 'queued',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });

  console.log('Seed complete: Demo tenant, users, memberships, sample note, and queued job are present.');
};

seed();
