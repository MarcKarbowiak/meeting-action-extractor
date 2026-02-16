import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type Role = 'admin' | 'member' | 'reader';

export type Tenant = {
  id: string;
  name: string;
  createdAt: string;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type Membership = {
  tenantId: string;
  userId: string;
  role: Role;
  createdAt: string;
};

export type NoteStatus = 'submitted' | 'processing' | 'ready' | 'failed';

export type Note = {
  id: string;
  tenantId: string;
  title: string;
  rawText: string;
  status: NoteStatus;
  createdBy: string;
  createdAt: string;
};

export type TaskStatus = 'suggested' | 'approved' | 'rejected';

export type Task = {
  id: string;
  tenantId: string;
  noteId: string;
  sourceJobId?: string;
  title: string;
  owner?: string;
  dueDate?: string;
  status: TaskStatus;
  confidence: number;
  createdAt: string;
  updatedAt: string;
};

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export type Job = {
  id: string;
  tenantId: string;
  noteId: string;
  status: JobStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  lockedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: 'tenant' | 'note' | 'task' | 'membership';
  entityId: string;
  details?: Record<string, string>;
  createdAt: string;
};

export type TenantSummary = {
  id: string;
  name: string;
  role: Role;
};

export type TenantMember = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
};

export type CreateTenantInput = {
  name: string;
  creatorUserId: string;
  creatorEmail: string;
  creatorDisplayName?: string;
};

export type CreateNoteInput = {
  tenantId: string;
  title: string;
  rawText: string;
  createdBy: string;
};

export type UpdateTaskInput = {
  status: TaskStatus;
  title?: string;
  owner?: string;
  dueDate?: string;
};

export type StoreData = {
  tenants: Tenant[];
  users: User[];
  memberships: Membership[];
  notes: Note[];
  tasks: Task[];
  jobs: Job[];
  auditEvents: AuditEvent[];
};

const EMPTY_DATA: StoreData = {
  tenants: [],
  users: [],
  memberships: [],
  notes: [],
  tasks: [],
  jobs: [],
  auditEvents: [],
};

const STORE_FILE_NAME = 'store.json';

const createId = (): string => globalThis.crypto.randomUUID();

const nowIso = (): string => new Date().toISOString();

const fallbackDisplayName = (email: string): string => {
  const name = email.split('@')[0] ?? 'user';
  return name;
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

export class LocalJsonStore {
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

  public createTenantWithAdmin(input: CreateTenantInput): Tenant {
    const data = this.read();

    const creator = this.upsertUserInternal(data, {
      id: input.creatorUserId,
      email: input.creatorEmail,
      displayName: input.creatorDisplayName ?? fallbackDisplayName(input.creatorEmail),
      createdAt: nowIso(),
    });

    const tenant: Tenant = {
      id: createId(),
      name: input.name,
      createdAt: nowIso(),
    };

    data.tenants.push(tenant);

    this.upsertMembershipInternal(data, {
      tenantId: tenant.id,
      userId: creator.id,
      role: 'admin',
      createdAt: nowIso(),
    });

    this.write(data);
    return tenant;
  }

  public upsertTenant(input: Omit<Tenant, 'createdAt'> & Partial<Pick<Tenant, 'createdAt'>>): Tenant {
    const data = this.read();
    const tenant: Tenant = {
      id: input.id,
      name: input.name,
      createdAt: input.createdAt ?? nowIso(),
    };

    const index = data.tenants.findIndex((value) => value.id === tenant.id);
    if (index === -1) {
      data.tenants.push(tenant);
    } else {
      data.tenants[index] = tenant;
    }

    this.write(data);
    return tenant;
  }

  public listTenantsForUser(userId: string): TenantSummary[] {
    const data = this.read();
    const memberships = data.memberships.filter((membership) => membership.userId === userId);

    return memberships
      .map((membership) => {
        const tenant = data.tenants.find((value) => value.id === membership.tenantId);
        if (!tenant) {
          return undefined;
        }

        return {
          id: tenant.id,
          name: tenant.name,
          role: membership.role,
        } satisfies TenantSummary;
      })
      .filter((value): value is TenantSummary => value !== undefined);
  }

  public upsertUser(input: Omit<User, 'displayName' | 'createdAt'> & Partial<Pick<User, 'displayName' | 'createdAt'>>): User {
    const data = this.read();
    const user = this.upsertUserInternal(data, {
      id: input.id,
      email: input.email,
      displayName: input.displayName ?? fallbackDisplayName(input.email),
      createdAt: input.createdAt ?? nowIso(),
    });

    this.write(data);
    return user;
  }

  public getUserById(userId: string): User | undefined {
    const data = this.read();
    return data.users.find((user) => user.id === userId);
  }

  public getUserByEmail(email: string): User | undefined {
    const data = this.read();
    return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  public addMembership(input: Omit<Membership, 'createdAt'> & Partial<Pick<Membership, 'createdAt'>>): Membership {
    const data = this.read();
    const duplicate = data.memberships.some(
      (membership) =>
        membership.tenantId === input.tenantId && membership.userId === input.userId,
    );

    if (duplicate) {
      throw new Error('Membership already exists for this tenant and user.');
    }

    const membership: Membership = {
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      createdAt: input.createdAt ?? nowIso(),
    };

    data.memberships.push(membership);
    this.write(data);
    return membership;
  }

  public upsertMembership(input: Omit<Membership, 'createdAt'> & Partial<Pick<Membership, 'createdAt'>>): Membership {
    const data = this.read();
    const membership = this.upsertMembershipInternal(data, {
      tenantId: input.tenantId,
      userId: input.userId,
      role: input.role,
      createdAt: input.createdAt ?? nowIso(),
    });

    this.write(data);
    return membership;
  }

  public getMembership(tenantId: string, userId: string): Membership | undefined {
    const data = this.read();
    return data.memberships.find(
      (membership) => membership.tenantId === tenantId && membership.userId === userId,
    );
  }

  public upsertMemberByEmail(tenantId: string, email: string, role: Role): TenantMember {
    const data = this.read();
    const tenant = data.tenants.find((value) => value.id === tenantId);
    if (!tenant) {
      throw new Error('Tenant not found.');
    }

    const existing = data.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    const user = existing
      ? this.upsertUserInternal(data, {
          ...existing,
          email,
        })
      : this.upsertUserInternal(data, {
          id: createId(),
          email,
          displayName: fallbackDisplayName(email),
          createdAt: nowIso(),
        });

    const membership = this.upsertMembershipInternal(data, {
      tenantId,
      userId: user.id,
      role,
      createdAt: nowIso(),
    });

    this.write(data);

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: membership.role,
    };
  }

  public listMembersByTenant(tenantId: string): TenantMember[] {
    const data = this.read();
    const memberships = data.memberships.filter((membership) => membership.tenantId === tenantId);

    return memberships
      .map((membership) => {
        const user = data.users.find((value) => value.id === membership.userId);
        if (!user) {
          return undefined;
        }

        return {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
          role: membership.role,
        } satisfies TenantMember;
      })
      .filter((value): value is TenantMember => value !== undefined);
  }

  public createNote(input: CreateNoteInput | string, legacyRawText?: string): Note {
    if (typeof input === 'string') {
      const tenantId = input;
      const rawText = legacyRawText ?? '';
      return this.createSubmittedNote({
        tenantId,
        title: 'Untitled note',
        rawText,
        createdBy: 'system',
      });
    }

    return this.createSubmittedNote(input);
  }

  public createSubmittedNoteAndEnqueueJob(input: CreateNoteInput): { note: Note; job: Job } {
    const note = this.createSubmittedNote(input);
    const job = this.enqueueJob(input.tenantId, note.id);

    return { note, job };
  }

  public upsertNote(input: Omit<Note, 'createdAt'> & Partial<Pick<Note, 'createdAt'>>): Note {
    const data = this.read();
    const note: Note = {
      id: input.id,
      tenantId: input.tenantId,
      title: input.title,
      rawText: input.rawText,
      status: input.status,
      createdBy: input.createdBy,
      createdAt: input.createdAt ?? nowIso(),
    };

    const index = data.notes.findIndex((value) => value.id === note.id);
    if (index === -1) {
      data.notes.push(note);
    } else {
      data.notes[index] = note;
    }

    this.write(data);
    return note;
  }

  public listNotesByTenant(tenantId: string, limit?: number, offset?: number): Note[] {
    const data = this.read();
    const filtered = data.notes.filter((note) => note.tenantId === tenantId);
    const start = offset ?? 0;
    const end = limit === undefined ? undefined : start + limit;

    return filtered.slice(start, end);
  }

  public getNoteByIdForTenant(tenantId: string, noteId: string): Note | undefined {
    const data = this.read();
    return data.notes.find((note) => note.id === noteId && note.tenantId === tenantId);
  }

  public deleteNoteForTenant(tenantId: string, noteId: string): boolean {
    const data = this.read();
    const noteIndex = data.notes.findIndex((note) => note.id === noteId && note.tenantId === tenantId);

    if (noteIndex === -1) {
      return false;
    }

    data.notes.splice(noteIndex, 1);
    data.tasks = data.tasks.filter((task) => !(task.tenantId === tenantId && task.noteId === noteId));
    data.jobs = data.jobs.filter((job) => !(job.tenantId === tenantId && job.noteId === noteId));

    this.write(data);
    return true;
  }

  public setNoteStatus(tenantId: string, noteId: string, status: NoteStatus): Note | undefined {
    const data = this.read();
    const index = data.notes.findIndex((note) => note.id === noteId && note.tenantId === tenantId);

    if (index === -1) {
      return undefined;
    }

    const existing = data.notes[index];
    if (!existing) {
      return undefined;
    }

    const updated: Note = {
      ...existing,
      status,
    };

    data.notes[index] = updated;
    this.write(data);

    return updated;
  }

  public createTask(input: {
    tenantId: string;
    noteId: string;
    sourceJobId?: string;
    title: string;
    owner?: string;
    dueDate?: string;
    status?: TaskStatus;
    confidence?: number;
  }): Task {
    const now = nowIso();
    const task: Task = {
      id: createId(),
      tenantId: input.tenantId,
      noteId: input.noteId,
      sourceJobId: input.sourceJobId,
      title: input.title,
      owner: input.owner,
      dueDate: input.dueDate,
      status: input.status ?? 'suggested',
      confidence: input.confidence ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    return this.upsertTask(task);
  }

  public upsertTask(input: Task): Task {
    const data = this.read();
    const index = data.tasks.findIndex((task) => task.id === input.id);

    if (index === -1) {
      data.tasks.push(input);
    } else {
      data.tasks[index] = input;
    }

    this.write(data);
    return input;
  }

  public listTasksByNote(tenantId: string, noteId: string): Task[] {
    const data = this.read();
    return data.tasks.filter((task) => task.tenantId === tenantId && task.noteId === noteId);
  }

  public replaceSuggestedTasksForJob(params: {
    tenantId: string;
    noteId: string;
    jobId: string;
    tasks: Array<{
      title: string;
      owner?: string;
      dueDate?: string;
      confidence: number;
    }>;
  }): Task[] {
    const data = this.read();

    data.tasks = data.tasks.filter(
      (task) =>
        !(
          task.tenantId === params.tenantId &&
          task.noteId === params.noteId &&
          task.status === 'suggested' &&
          task.sourceJobId === params.jobId
        ),
    );

    const createdAt = nowIso();
    const inserted: Task[] = params.tasks.map((task, index) => ({
      id: `${params.jobId}:suggested:${String(index + 1).padStart(3, '0')}`,
      tenantId: params.tenantId,
      noteId: params.noteId,
      sourceJobId: params.jobId,
      title: task.title,
      owner: task.owner,
      dueDate: task.dueDate,
      status: 'suggested',
      confidence: task.confidence,
      createdAt,
      updatedAt: createdAt,
    }));

    data.tasks.push(...inserted);
    this.write(data);

    return inserted;
  }

  public listTasksByTenant(tenantId: string, status?: TaskStatus): Task[] {
    const data = this.read();

    return data.tasks.filter(
      (task) => task.tenantId === tenantId && (status === undefined || task.status === status),
    );
  }

  public getTaskByIdForTenant(tenantId: string, taskId: string): Task | undefined {
    const data = this.read();
    return data.tasks.find((task) => task.id === taskId && task.tenantId === tenantId);
  }

  public updateTaskForTenant(tenantId: string, taskId: string, patch: UpdateTaskInput): Task | undefined {
    const data = this.read();
    const index = data.tasks.findIndex((task) => task.id === taskId && task.tenantId === tenantId);

    if (index === -1) {
      return undefined;
    }

    const existing = data.tasks[index];
    if (!existing) {
      return undefined;
    }

    const updated: Task = {
      ...existing,
      status: patch.status,
      title: patch.title ?? existing.title,
      owner: patch.owner ?? existing.owner,
      dueDate: patch.dueDate ?? existing.dueDate,
      updatedAt: nowIso(),
    };

    data.tasks[index] = updated;
    this.write(data);

    return updated;
  }

  public enqueueJob(tenantId: string, noteId: string): Job {
    const now = nowIso();
    const job: Job = {
      id: createId(),
      tenantId,
      noteId,
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
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

    next.lockedAt = nowIso();
    next.status = 'processing';
    next.updatedAt = nowIso();
    this.write(data);

    return next;
  }

  public markJobCompleted(jobId: string): Job | undefined {
    const data = this.read();
    const index = data.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return undefined;
    }

    const existing = data.jobs[index];
    if (!existing) {
      return undefined;
    }

    const now = nowIso();
    const updated: Job = {
      ...existing,
      status: 'done',
      lockedAt: undefined,
      lastError: undefined,
      completedAt: now,
      updatedAt: now,
    };

    data.jobs[index] = updated;
    this.write(data);

    return updated;
  }

  public markJobAttemptFailed(jobId: string, errorMessage: string, maxAttempts = 3): Job | undefined {
    const data = this.read();
    const index = data.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return undefined;
    }

    const existing = data.jobs[index];
    if (!existing) {
      return undefined;
    }

    const attempts = existing.attempts + 1;
    const shouldFail = attempts >= maxAttempts;

    const updated: Job = {
      ...existing,
      attempts,
      lastError: errorMessage,
      status: shouldFail ? 'failed' : 'queued',
      lockedAt: undefined,
      updatedAt: nowIso(),
    };

    data.jobs[index] = updated;
    this.write(data);

    return updated;
  }

  public getJobById(jobId: string): Job | undefined {
    const data = this.read();
    return data.jobs.find((job) => job.id === jobId);
  }

  public addAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): AuditEvent {
    const data = this.read();
    const value: AuditEvent = {
      id: createId(),
      createdAt: nowIso(),
      ...event,
    };

    data.auditEvents.push(value);
    this.write(data);

    return value;
  }

  public getSnapshot(): StoreData {
    return this.read();
  }

  private createSubmittedNote(input: CreateNoteInput): Note {
    const now = nowIso();
    const note: Note = {
      id: createId(),
      tenantId: input.tenantId,
      title: input.title,
      rawText: input.rawText,
      status: 'submitted',
      createdBy: input.createdBy,
      createdAt: now,
    };

    return this.upsertNote(note);
  }

  private ensureDir(): void {
    mkdirSync(this.dataDir, { recursive: true });
  }

  private read(): StoreData {
    this.initialize();
    const raw = readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;

    return {
      tenants: parsed.tenants ?? [],
      users: parsed.users ?? [],
      memberships: parsed.memberships ?? [],
      notes: parsed.notes ?? [],
      tasks: (parsed.tasks ?? []).map((task) => ({
        ...task,
        sourceJobId: task.sourceJobId,
      })),
      jobs: (parsed.jobs ?? []).map((job) => ({
        ...job,
        attempts: job.attempts ?? 0,
        updatedAt: job.updatedAt ?? job.createdAt ?? nowIso(),
      })),
      auditEvents: parsed.auditEvents ?? [],
    };
  }

  private write(data: StoreData): void {
    this.ensureDir();
    writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  }

  private upsertUserInternal(data: StoreData, input: User): User {
    const index = data.users.findIndex(
      (user) => user.id === input.id || user.email.toLowerCase() === input.email.toLowerCase(),
    );

    if (index === -1) {
      data.users.push(input);
      return input;
    }

    const existing = data.users[index];
    if (!existing) {
      data.users.push(input);
      return input;
    }

    const merged: User = {
      ...existing,
      id: input.id,
      email: input.email,
      displayName: input.displayName,
      createdAt: existing.createdAt,
    };

    data.users[index] = merged;
    return merged;
  }

  private upsertMembershipInternal(data: StoreData, input: Membership): Membership {
    const index = data.memberships.findIndex(
      (membership) =>
        membership.tenantId === input.tenantId && membership.userId === input.userId,
    );

    if (index === -1) {
      data.memberships.push(input);
      return input;
    }

    const existing = data.memberships[index];
    if (!existing) {
      data.memberships.push(input);
      return input;
    }

    const merged: Membership = {
      ...existing,
      role: input.role,
      createdAt: existing.createdAt,
    };

    data.memberships[index] = merged;
    return merged;
  }
}

export class LocalFileStore extends LocalJsonStore {}
