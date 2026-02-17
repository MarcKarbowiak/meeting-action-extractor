import type { LocalJsonStore } from '@meeting-action-extractor/db';
import { type IExtractionProvider, RulesExtractionProvider } from '@meeting-action-extractor/extractor';
import { buildSpanAttributes, getTracer, runWithSpan } from '@meeting-action-extractor/shared';

export type WorkerLogger = {
  info(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export type RunOnceOptions = {
  store: LocalJsonStore;
  provider?: IExtractionProvider;
  logger?: WorkerLogger;
  maxJobs?: number;
  maxAttempts?: number;
};

export type StartLoopOptions = RunOnceOptions & {
  intervalMs?: number;
};

const createDefaultLogger = (): WorkerLogger => {
  return {
    info(payload, message) {
      console.info(JSON.stringify({ level: 'info', message, ...payload }));
    },
    error(payload, message) {
      console.error(JSON.stringify({ level: 'error', message, ...payload }));
    },
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown worker error';
};

const workerTracer = getTracer('worker');

const processSingleJob = async (params: {
  store: LocalJsonStore;
  job: { id: string; tenantId: string; noteId: string; status: string };
  provider: IExtractionProvider;
  logger: WorkerLogger;
  maxAttempts: number;
}): Promise<boolean> => {
  const { store, provider, logger, maxAttempts, job } = params;

  logger.info(
    {
      tenantId: job.tenantId,
      jobId: job.id,
      noteId: job.noteId,
      status: job.status,
      transition: 'queued->processing',
    },
    'worker.job.locked',
  );

  await runWithSpan({
    tracer: workerTracer,
    name: 'worker.processJob',
    attributes: buildSpanAttributes({
      deploymentEnvironment: process.env.NODE_ENV ?? 'local',
      tenantId: job.tenantId,
      jobId: job.id,
      noteId: job.noteId,
    }),
    run: async () => {
      try {
        await runWithSpan({
          tracer: workerTracer,
          name: 'store.jobs.lock',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: job.noteId,
          }),
          run: () => job,
        });

        const note = await runWithSpan({
          tracer: workerTracer,
          name: 'store.notes.get',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: job.noteId,
          }),
          run: () => store.getNoteByIdForTenant(job.tenantId, job.noteId),
        });

        if (!note) {
          throw new Error('Note not found for job.');
        }

        await runWithSpan({
          tracer: workerTracer,
          name: 'store.notes.set_status',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: job.noteId,
          }),
          run: () => store.setNoteStatus(job.tenantId, job.noteId, 'processing'),
        });

        const extractedTasks = await runWithSpan({
          tracer: workerTracer,
          name: 'extractor.rules.extract',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
          }),
          run: () => provider.extractTasks(note.rawText),
        });

        const suggested = await runWithSpan({
          tracer: workerTracer,
          name: 'store.tasks.upsert',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
          }),
          run: () =>
            store.replaceSuggestedTasksForJob({
              tenantId: job.tenantId,
              noteId: note.id,
              jobId: job.id,
              tasks: extractedTasks,
            }),
        });

        const completedJob = await runWithSpan({
          tracer: workerTracer,
          name: 'store.jobs.complete',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
          }),
          run: () => store.markJobCompleted(job.id),
        });

        if (!completedJob) {
          throw new Error('Job not found while marking completion.');
        }

        await runWithSpan({
          tracer: workerTracer,
          name: 'store.notes.set_status',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
          }),
          run: () => store.setNoteStatus(job.tenantId, job.noteId, 'ready'),
        });

        await runWithSpan({
          tracer: workerTracer,
          name: 'store.audit.write',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
          }),
          run: () =>
            store.addAuditEvent({
              tenantId: job.tenantId,
              actorUserId: 'worker',
              action: 'job_completed',
              entityType: 'note',
              entityId: note.id,
              details: {
                jobId: job.id,
              },
            }),
        });

        await runWithSpan({
          tracer: workerTracer,
          name: 'store.audit.write',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
          }),
          run: () =>
            store.addAuditEvent({
              tenantId: job.tenantId,
              actorUserId: 'worker',
              action: 'tasks_suggested_count',
              entityType: 'note',
              entityId: note.id,
              details: {
                jobId: job.id,
                count: String(suggested.length),
              },
            }),
        });

        logger.info(
          {
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: note.id,
            tasksSuggested: suggested.length,
            status: completedJob.status,
            transition: 'processing->done',
          },
          'worker.job.completed',
        );
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);

        const updatedJob = await runWithSpan({
          tracer: workerTracer,
          name: 'store.jobs.fail',
          attributes: buildSpanAttributes({
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: job.noteId,
          }),
          run: () => store.markJobAttemptFailed(job.id, errorMessage, maxAttempts),
        });

        if (updatedJob?.status === 'failed') {
          await runWithSpan({
            tracer: workerTracer,
            name: 'store.notes.set_status',
            attributes: buildSpanAttributes({
              tenantId: job.tenantId,
              jobId: job.id,
              noteId: job.noteId,
            }),
            run: () => store.setNoteStatus(job.tenantId, job.noteId, 'failed'),
          });

          await runWithSpan({
            tracer: workerTracer,
            name: 'store.audit.write',
            attributes: buildSpanAttributes({
              tenantId: job.tenantId,
              jobId: job.id,
              noteId: job.noteId,
            }),
            run: () =>
              store.addAuditEvent({
                tenantId: job.tenantId,
                actorUserId: 'worker',
                action: 'job_failed',
                entityType: 'note',
                entityId: job.noteId,
                details: {
                  jobId: job.id,
                  attempts: String(updatedJob.attempts),
                  error: errorMessage,
                },
              }),
          });
        }

        logger.error(
          {
            tenantId: job.tenantId,
            jobId: job.id,
            noteId: job.noteId,
            status: updatedJob?.status,
            attempts: updatedJob?.attempts,
          },
          `worker.job.failed: ${errorMessage}`,
        );
      }
    },
  });

  return true;
};

export const runOnce = async (options: RunOnceOptions): Promise<number> => {
  const provider = options.provider ?? new RulesExtractionProvider();
  const logger = options.logger ?? createDefaultLogger();
  const maxJobs = options.maxJobs ?? 5;
  const maxAttempts = options.maxAttempts ?? 3;

  let processed = 0;
  while (processed < maxJobs) {
    const job = await runWithSpan({
      tracer: workerTracer,
      name: 'store.jobs.lock',
      attributes: buildSpanAttributes({
        deploymentEnvironment: process.env.NODE_ENV ?? 'local',
      }),
      run: () => options.store.lockNextJob(),
    });

    if (!job) {
      break;
    }

    const didProcess = await processSingleJob({
      store: options.store,
      job,
      provider,
      logger,
      maxAttempts,
    });

    if (!didProcess) {
      break;
    }

    processed += 1;
  }

  logger.info({ processed }, 'worker.runOnce.finished');
  return processed;
};

export const startLoop = (options: StartLoopOptions): { stop: () => void } => {
  const intervalMs = options.intervalMs ?? 1000;
  let active = true;

  const timer = setInterval(() => {
    if (!active) {
      return;
    }

    void runOnce(options);
  }, intervalMs);

  return {
    stop() {
      active = false;
      clearInterval(timer);
    },
  };
};
