import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import type { LocalJsonStore, Role } from '@meeting-action-extractor/db';
import { z, ZodError, type ZodType } from 'zod';

import { deriveAuthContext } from './auth.js';
import { tasksToCsv } from './csv.js';
import { ApiError, toApiErrorPayload } from './errors.js';
import { requireRole, enforceReaderWriteRestriction } from './rbac.js';
import { getStore } from './store-provider.js';
import type { ApiMode, AuthContext } from './types.js';

type RequestWithAuth = FastifyRequest & { authContext: AuthContext };

type BuildApiAppOptions = {
  mode?: ApiMode;
  store?: LocalJsonStore;
};

const roleSchema = z.enum(['admin', 'member', 'reader']);
const taskStatusSchema = z.enum(['suggested', 'approved', 'rejected']);

const parseOrThrow = <T>(schema: ZodType<T>, payload: unknown): T => {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Validation error.', result.error.flatten());
  }

  return result.data;
};

const assertTenantScope = (auth: AuthContext, tenantId: string): void => {
  if (auth.tenantId !== tenantId) {
    throw new ApiError(404, 'not_found', 'Entity not found.');
  }
};

const getAuth = (request: FastifyRequest): AuthContext => {
  const auth = (request as RequestWithAuth).authContext;
  if (!auth) {
    throw new ApiError(401, 'unauthorized', 'Missing auth context.');
  }

  return auth;
};

export const buildApiApp = (options: BuildApiAppOptions = {}): FastifyInstance => {
  const mode: ApiMode = options.mode ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  const store = options.store ?? getStore();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const rawBody = typeof body === 'string' ? body : '';

    if (rawBody.trim() === '') {
      done(null, {});
      return;
    }

    try {
      done(null, JSON.parse(rawBody));
    } catch {
      done(new ApiError(400, 'bad_request', 'Malformed JSON body.'), undefined);
    }
  });

  // Enable CORS for web app
  app.register(cors, {
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    const authContext = deriveAuthContext({
      headers: request.headers,
      mode,
      store,
    });

    (request as RequestWithAuth).authContext = authContext;
    enforceReaderWriteRestriction(authContext, request.method);

    reply.header('x-request-id', request.id);

    request.log.info(
      {
        requestId: request.id,
        tenantId: authContext.tenantId,
        userId: authContext.userId,
      },
      'request.authenticated',
    );
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      reply.status(error.statusCode).send(toApiErrorPayload(error));
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send(
        toApiErrorPayload(new ApiError(400, 'bad_request', 'Validation error.', error.flatten())),
      );
      return;
    }

    request.log.error({ err: error, requestId: request.id }, 'request.error');
    reply
      .status(500)
      .send(toApiErrorPayload(new ApiError(500, 'internal_error', 'Unexpected server error.')));
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      version: '0.1.0',
      mode,
    };
  });

  app.get('/me', async (request) => {
    const auth = getAuth(request);

    return {
      user: {
        id: auth.userId,
        email: auth.email,
        displayName: auth.displayName,
      },
      tenantId: auth.tenantId,
      roles: auth.roles,
    };
  });

  app.get('/tenants', async (request) => {
    const auth = getAuth(request);
    return {
      tenants: store.listTenantsForUser(auth.userId),
    };
  });

  app.post('/tenants', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'member');

    const body = parseOrThrow(
      z.object({
        name: z.string().trim().min(1).max(128),
      }),
      request.body,
    );

    const tenant = store.createTenantWithAdmin({
      name: body.name,
      creatorUserId: auth.userId,
      creatorEmail: auth.email,
      creatorDisplayName: auth.displayName,
    });

    store.addAuditEvent({
      tenantId: tenant.id,
      actorUserId: auth.userId,
      action: 'tenant.created',
      entityType: 'tenant',
      entityId: tenant.id,
      details: {
        name: tenant.name,
      },
    });

    request.log.info(
      {
        requestId: request.id,
        tenantId: tenant.id,
        userId: auth.userId,
      },
      'audit.tenant.created',
    );

    return {
      tenant,
    };
  });

  app.post('/notes', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'member');

    const body = parseOrThrow(
      z.object({
        title: z.string().trim().min(1).max(200),
        rawText: z.string().trim().min(1),
      }),
      request.body,
    );

    const result = store.createSubmittedNoteAndEnqueueJob({
      tenantId: auth.tenantId,
      title: body.title,
      rawText: body.rawText,
      createdBy: auth.userId,
    });

    store.addAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'note.submitted',
      entityType: 'note',
      entityId: result.note.id,
      details: {
        jobId: result.job.id,
      },
    });

    request.log.info(
      {
        requestId: request.id,
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: result.note.id,
        jobId: result.job.id,
      },
      'audit.note.submitted',
    );

    return {
      note: result.note,
      job: result.job,
    };
  });

  app.get('/notes', async (request) => {
    const auth = getAuth(request);

    const query = parseOrThrow(
      z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      }),
      request.query,
    );

    return {
      notes: store.listNotesByTenant(auth.tenantId, query.limit, query.offset),
    };
  });

  app.get('/notes/:id', async (request) => {
    const auth = getAuth(request);

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const note = store.getNoteByIdForTenant(auth.tenantId, params.id);
    if (!note) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    return { note };
  });

  app.get('/notes/:id/tasks', async (request) => {
    const auth = getAuth(request);

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const note = store.getNoteByIdForTenant(auth.tenantId, params.id);
    if (!note) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    return {
      tasks: store.listTasksByNote(auth.tenantId, note.id),
    };
  });

  app.delete('/notes/:id', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'member');

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const note = store.getNoteByIdForTenant(auth.tenantId, params.id);
    if (!note) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    const deleted = store.deleteNoteForTenant(auth.tenantId, params.id);
    if (!deleted) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    store.addAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'note.deleted',
      entityType: 'note',
      entityId: params.id,
      details: {
        title: note.title,
      },
    });

    request.log.info(
      {
        requestId: request.id,
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: params.id,
      },
      'audit.note.deleted',
    );

    return {
      deleted: true,
      noteId: params.id,
    };
  });

  app.patch('/tasks/:id', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'member');

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const body = parseOrThrow(
      z.object({
        status: taskStatusSchema,
        title: z.string().trim().min(1).max(240).optional(),
        owner: z.string().trim().min(1).max(200).optional(),
        dueDate: z.string().trim().min(1).max(50).optional(),
      }),
      request.body,
    );

    const updated = store.updateTaskForTenant(auth.tenantId, params.id, body);
    if (!updated) {
      throw new ApiError(404, 'not_found', 'Task not found.');
    }

    store.addAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'task.updated',
      entityType: 'task',
      entityId: updated.id,
      details: {
        status: updated.status,
      },
    });

    request.log.info(
      {
        requestId: request.id,
        tenantId: auth.tenantId,
        userId: auth.userId,
        taskId: updated.id,
      },
      'audit.task.updated',
    );

    return {
      task: updated,
    };
  });

  app.get('/tasks', async (request) => {
    const auth = getAuth(request);

    const query = parseOrThrow(
      z.object({
        status: taskStatusSchema.optional(),
      }),
      request.query,
    );

    return {
      tasks: store.listTasksByTenant(auth.tenantId, query.status),
    };
  });

  app.get('/tasks/export.csv', async (request, reply) => {
    const auth = getAuth(request);

    const query = parseOrThrow(
      z.object({
        status: taskStatusSchema.optional(),
      }),
      request.query,
    );

    const tasks = store.listTasksByTenant(auth.tenantId, query.status);
    const csv = tasksToCsv(tasks);

    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="tasks.csv"');

    return reply.send(csv);
  });

  app.get('/tenants/:id/members', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'admin');

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    assertTenantScope(auth, params.id);

    return {
      members: store.listMembersByTenant(params.id),
    };
  });

  app.post('/tenants/:id/members', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'admin');

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    assertTenantScope(auth, params.id);

    const body = parseOrThrow(
      z.object({
        email: z.string().email(),
        role: roleSchema,
      }),
      request.body,
    );

    const member = store.upsertMemberByEmail(params.id, body.email, body.role as Role);

    store.addAuditEvent({
      tenantId: params.id,
      actorUserId: auth.userId,
      action: 'membership.upserted',
      entityType: 'membership',
      entityId: member.userId,
      details: {
        email: member.email,
        role: member.role,
      },
    });

    request.log.info(
      {
        requestId: request.id,
        tenantId: params.id,
        userId: auth.userId,
        memberUserId: member.userId,
      },
      'audit.membership.upserted',
    );

    return {
      member,
    };
  });

  return app;
};
