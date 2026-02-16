import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type Role = 'admin' | 'member' | 'reader';

export type Tenant = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  email: string;
};

export type Membership = {
  tenantId: string;
  userId: string;
  role: Role;
};

export type Note = {
  id: string;
  tenantId: string;
  content: string;
  createdAt: string;
};

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export type Job = {
  id: string;
  tenantId: string;
  noteId: string;
  status: JobStatus;
  createdAt: string;
  lockedAt?: string;
};

type StoreData = {
  tenants: Tenant[];
  users: User[];
  memberships: Membership[];
  notes: Note[];
  jobs: Job[];
};

const EMPTY_DATA: StoreData = {
  tenants: [],
  users: [],
  memberships: [],
  notes: [],
  jobs: [],
};

const STORE_FILE_NAME = 'store.json';

const createId = (): string => {
  return globalThis.crypto.randomUUID();
};

export const findWorkspaceRoot = (startDir = process.cwd()): string => {
  let current = resolve(startDir);

  while (true) {
    const marker = join(current, 'pnpm-workspace.yaml');
    if (existsSync(marker)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(startDir);
    }

    current = parent;
  }
};

export const getDefaultDataDir = (): string => {
  return join(findWorkspaceRoot(), '.local-data');
};

export class LocalFileStore {
  private readonly filePath: string;

  constructor(private readonly dataDir = getDefaultDataDir()) {
    this.filePath = join(this.dataDir, STORE_FILE_NAME);
  }

  public initialize(): void {
    this.ensureDir();
    if (!existsSync(this.filePath)) {
      this.write(EMPTY_DATA);
    }
  }

  public reset(): void {
    this.ensureDir();
    this.write(EMPTY_DATA);
  }

  public upsertTenant(input: Tenant): Tenant {
    const data = this.read();
    const index = data.tenants.findIndex((tenant) => tenant.id === input.id);

    if (index === -1) {
      data.tenants.push(input);
    } else {
      data.tenants[index] = input;
    }

    this.write(data);
    return input;
  }

  public upsertUser(input: User): User {
    const data = this.read();
    const index = data.users.findIndex((user) => user.id === input.id || user.email === input.email);

    if (index === -1) {
      data.users.push(input);
    } else {
      data.users[index] = { ...data.users[index], ...input };
    }

    this.write(data);
    return input;
  }

  public addMembership(input: Membership): Membership {
    const data = this.read();
    const duplicate = data.memberships.some(
      (membership) =>
        membership.tenantId === input.tenantId && membership.userId === input.userId,
    );

    if (duplicate) {
      throw new Error('Membership already exists for this tenant and user.');
    }

    data.memberships.push(input);
    this.write(data);
    return input;
  }

  public upsertMembership(input: Membership): Membership {
    const data = this.read();
    const index = data.memberships.findIndex(
      (membership) =>
        membership.tenantId === input.tenantId && membership.userId === input.userId,
    );

    if (index === -1) {
      data.memberships.push(input);
    } else {
      data.memberships[index] = input;
    }

    this.write(data);
    return input;
  }

  public createNote(tenantId: string, content: string): Note {
    const now = new Date().toISOString();
    const note: Note = {
      id: createId(),
      tenantId,
      content,
      createdAt: now,
    };

    return this.upsertNote(note);
  }

  public upsertNote(input: Note): Note {
    const data = this.read();
    const index = data.notes.findIndex((note) => note.id === input.id);

    if (index === -1) {
      data.notes.push(input);
    } else {
      data.notes[index] = input;
    }

    this.write(data);
    return input;
  }

  public listNotesByTenant(tenantId: string): Note[] {
    const data = this.read();
    return data.notes.filter((note) => note.tenantId === tenantId);
  }

  public getNoteByIdForTenant(tenantId: string, noteId: string): Note | undefined {
    const data = this.read();
    return data.notes.find((note) => note.id === noteId && note.tenantId === tenantId);
  }

  public enqueueJob(tenantId: string, noteId: string): Job {
    const now = new Date().toISOString();
    const job: Job = {
      id: createId(),
      tenantId,
      noteId,
      status: 'queued',
      createdAt: now,
    };

    return this.upsertJob(job);
  }

  public upsertJob(input: Job): Job {
    const data = this.read();
    const index = data.jobs.findIndex((job) => job.id === input.id);

    if (index === -1) {
      data.jobs.push(input);
    } else {
      data.jobs[index] = input;
    }

    this.write(data);
    return input;
  }

  public lockNextJob(tenantId?: string): Job | undefined {
    const data = this.read();
    const next = data.jobs.find(
      (job) =>
        job.status === 'queued' &&
        job.lockedAt === undefined &&
        (tenantId === undefined || job.tenantId === tenantId),
    );

    if (!next) {
      return undefined;
    }

    next.lockedAt = new Date().toISOString();
    next.status = 'processing';
    this.write(data);

    return next;
  }

  public getSnapshot(): StoreData {
    return this.read();
  }

  private ensureDir(): void {
    mkdirSync(this.dataDir, { recursive: true });
  }

  private read(): StoreData {
    this.initialize();
    const raw = readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;

    return {
      tenants: parsed.tenants ?? [],
      users: parsed.users ?? [],
      memberships: parsed.memberships ?? [],
      notes: parsed.notes ?? [],
      jobs: parsed.jobs ?? [],
    };
  }

  private write(data: StoreData): void {
    this.ensureDir();
    writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }
}
