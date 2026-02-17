import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import type { LocalJsonStore, Role } from '@meeting-action-extractor/db';
import {
  buildSpanAttributes,
  getFlag,
  getTracer,
  parseEnvFlags,
  parseHeaderFlags,
  runWithSpan,
} from '@meeting-action-extractor/shared';
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

const apiTracer = getTracer('api');

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const getFlagContext = (request: FastifyRequest, auth?: AuthContext) => {
  const environment = process.env.NODE_ENV ?? 'local';

  return {
    environment,
    tenantId: auth?.tenantId,
    userId: auth?.userId,
    roles: auth?.roles,
    envFlags: parseEnvFlags(),
    headerFlags: parseHeaderFlags(getHeaderValue(request.headers['x-feature-flags'])),
  };
};

const withRequestSpan = (
  routeName: string,
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown,
) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as RequestWithAuth).authContext;

    return runWithSpan({
      tracer: apiTracer,
      name: routeName,
      attributes: buildSpanAttributes({
        deploymentEnvironment: process.env.NODE_ENV ?? 'local',
        requestId: request.id,
        tenantId: auth?.tenantId,
        userId: auth?.userId,
      }),
      run: async () => handler(request, reply),
    });
  };
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

  app.get('/health', withRequestSpan('GET /health', async () => {
    return {
      status: 'ok',
      version: '0.1.0',
      mode,
    };
  }));

  app.get('/me', withRequestSpan('GET /me', async (request) => {
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
  }));

  app.get('/tenants', withRequestSpan('GET /tenants', async (request) => {
    const auth = getAuth(request);

    const tenants = await runWithSpan({
      tracer: apiTracer,
      name: 'store.tenants.list_for_user',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.listTenantsForUser(auth.userId),
    });

    return {
      tenants,
    };
  }));

  app.post('/tenants', withRequestSpan('POST /tenants', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'member');

    const body = parseOrThrow(
      z.object({
        name: z.string().trim().min(1).max(128),
      }),
      request.body,
    );

    const tenant = await runWithSpan({
      tracer: apiTracer,
      name: 'store.tenants.create',
      attributes: buildSpanAttributes({
        userId: auth.userId,
      }),
      run: () =>
        store.createTenantWithAdmin({
          name: body.name,
          creatorUserId: auth.userId,
          creatorEmail: auth.email,
          creatorDisplayName: auth.displayName,
        }),
    });

    await runWithSpan({
      tracer: apiTracer,
      name: 'store.audit.write',
      attributes: buildSpanAttributes({
        tenantId: tenant.id,
        userId: auth.userId,
      }),
      run: () =>
        store.addAuditEvent({
          tenantId: tenant.id,
          actorUserId: auth.userId,
          action: 'tenant.created',
          entityType: 'tenant',
          entityId: tenant.id,
          details: {
            name: tenant.name,
          },
        }),
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
  }));

  app.post('/notes', withRequestSpan('POST /notes', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'member');

    const body = parseOrThrow(
      z.object({
        title: z.string().trim().min(1).max(200),
        rawText: z.string().trim().min(1),
      }),
      request.body,
    );

    const note = await runWithSpan({
      tracer: apiTracer,
      name: 'store.notes.create',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () =>
        store.createNote({
          tenantId: auth.tenantId,
          title: body.title,
          rawText: body.rawText,
          createdBy: auth.userId,
        }),
    });

    const job = await runWithSpan({
      tracer: apiTracer,
      name: 'store.jobs.enqueue',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: note.id,
      }),
      run: () => store.enqueueJob(auth.tenantId, note.id),
    });

    await runWithSpan({
      tracer: apiTracer,
      name: 'store.audit.write',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: note.id,
        jobId: job.id,
      }),
      run: () =>
        store.addAuditEvent({
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: 'note.submitted',
          entityType: 'note',
          entityId: note.id,
          details: {
            jobId: job.id,
          },
        }),
    });

    request.log.info(
      {
        requestId: request.id,
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: note.id,
        jobId: job.id,
      },
      'audit.note.submitted',
    );

    return {
      note,
      job,
    };
  }));

  app.get('/notes', withRequestSpan('GET /notes', async (request) => {
    const auth = getAuth(request);

    const query = parseOrThrow(
      z.object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      }),
      request.query,
    );

    const notes = await runWithSpan({
      tracer: apiTracer,
      name: 'store.notes.list',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.listNotesByTenant(auth.tenantId, query.limit, query.offset),
    });

    return {
      notes,
    };
  }));

  app.get('/notes/:id', withRequestSpan('GET /notes/:id', async (request) => {
    const auth = getAuth(request);

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const note = await runWithSpan({
      tracer: apiTracer,
      name: 'store.notes.get',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: params.id,
      }),
      run: () => store.getNoteByIdForTenant(auth.tenantId, params.id),
    });
    if (!note) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    return { note };
  }));

  app.get('/notes/:id/tasks', withRequestSpan('GET /notes/:id/tasks', async (request) => {
    const auth = getAuth(request);

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const note = await runWithSpan({
      tracer: apiTracer,
      name: 'store.notes.get',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: params.id,
      }),
      run: () => store.getNoteByIdForTenant(auth.tenantId, params.id),
    });
    if (!note) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    const tasks = await runWithSpan({
      tracer: apiTracer,
      name: 'store.tasks.list_by_note',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: note.id,
      }),
      run: () => store.listTasksByNote(auth.tenantId, note.id),
    });

    return {
      tasks,
    };
  }));

  app.delete('/notes/:id', withRequestSpan('DELETE /notes/:id', async (request) => {
    const auth = getAuth(request);

    const allowDelete = getFlag('notes.allowDelete', getFlagContext(request, auth)) === true;
    if (!allowDelete) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    requireRole(auth, 'admin');

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    const note = await runWithSpan({
      tracer: apiTracer,
      name: 'store.notes.get',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: params.id,
      }),
      run: () => store.getNoteByIdForTenant(auth.tenantId, params.id),
    });
    if (!note) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    const deleted = await runWithSpan({
      tracer: apiTracer,
      name: 'store.notes.delete',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: params.id,
      }),
      run: () => store.deleteNoteForTenant(auth.tenantId, params.id),
    });
    if (!deleted) {
      throw new ApiError(404, 'not_found', 'Note not found.');
    }

    await runWithSpan({
      tracer: apiTracer,
      name: 'store.audit.write',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
        noteId: params.id,
      }),
      run: () =>
        store.addAuditEvent({
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: 'note_deleted',
          entityType: 'note',
          entityId: params.id,
          details: {
            title: note.title,
          },
        }),
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
  }));

  app.patch('/tasks/:id', withRequestSpan('PATCH /tasks/:id', async (request) => {
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

    const updated = await runWithSpan({
      tracer: apiTracer,
      name: 'store.tasks.update',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.updateTaskForTenant(auth.tenantId, params.id, body),
    });
    if (!updated) {
      throw new ApiError(404, 'not_found', 'Task not found.');
    }

    await runWithSpan({
      tracer: apiTracer,
      name: 'store.audit.write',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () =>
        store.addAuditEvent({
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          action: 'task.updated',
          entityType: 'task',
          entityId: updated.id,
          details: {
            status: updated.status,
          },
        }),
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
  }));

  app.get('/tasks', withRequestSpan('GET /tasks', async (request) => {
    const auth = getAuth(request);

    const query = parseOrThrow(
      z.object({
        status: taskStatusSchema.optional(),
      }),
      request.query,
    );

    const tasks = await runWithSpan({
      tracer: apiTracer,
      name: 'store.tasks.list',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.listTasksByTenant(auth.tenantId, query.status),
    });

    return {
      tasks,
    };
  }));

  app.get('/tasks/export.csv', withRequestSpan('GET /tasks/export.csv', async (request, reply) => {
    const auth = getAuth(request);

    const query = parseOrThrow(
      z.object({
        status: taskStatusSchema.optional(),
      }),
      request.query,
    );

    const tasks = await runWithSpan({
      tracer: apiTracer,
      name: 'store.tasks.list',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.listTasksByTenant(auth.tenantId, query.status),
    });
    const csv = tasksToCsv(tasks);

    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="tasks.csv"');

    return reply.send(csv);
  }));

  app.get('/tenants/:id/members', withRequestSpan('GET /tenants/:id/members', async (request) => {
    const auth = getAuth(request);
    requireRole(auth, 'admin');

    const params = parseOrThrow(
      z.object({
        id: z.string().min(1),
      }),
      request.params,
    );

    assertTenantScope(auth, params.id);

    const members = await runWithSpan({
      tracer: apiTracer,
      name: 'store.members.list',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.listMembersByTenant(params.id),
    });

    return {
      members,
    };
  }));

  app.post('/tenants/:id/members', withRequestSpan('POST /tenants/:id/members', async (request) => {
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

    const member = await runWithSpan({
      tracer: apiTracer,
      name: 'store.members.upsert',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () => store.upsertMemberByEmail(params.id, body.email, body.role as Role),
    });

    await runWithSpan({
      tracer: apiTracer,
      name: 'store.audit.write',
      attributes: buildSpanAttributes({
        tenantId: auth.tenantId,
        userId: auth.userId,
      }),
      run: () =>
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
        }),
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
  }));

  return app;
};
