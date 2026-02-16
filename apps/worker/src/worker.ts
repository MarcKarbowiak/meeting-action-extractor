import type { LocalJsonStore } from '@meeting-action-extractor/db';
import { type IExtractionProvider, RulesExtractionProvider } from '@meeting-action-extractor/extractor';

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

const processSingleJob = (params: {
  store: LocalJsonStore;
  provider: IExtractionProvider;
  logger: WorkerLogger;
  maxAttempts: number;
}): boolean => {
  const { store, provider, logger, maxAttempts } = params;

  const job = store.lockNextJob();
  if (!job) {
    return false;
  }

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

  try {
    const note = store.setNoteStatus(job.tenantId, job.noteId, 'processing');
    if (!note) {
      throw new Error('Note not found for job.');
    }

    const extractedTasks = provider.extractTasks(note.rawText);
    const suggested = store.replaceSuggestedTasksForJob({
      tenantId: job.tenantId,
      noteId: note.id,
      jobId: job.id,
      tasks: extractedTasks,
    });

    const completedJob = store.markJobCompleted(job.id);
    if (!completedJob) {
      throw new Error('Job not found while marking completion.');
    }

    const readyNote = store.setNoteStatus(job.tenantId, job.noteId, 'ready');
    if (!readyNote) {
      throw new Error('Note not found while marking ready status.');
    }

    store.addAuditEvent({
      tenantId: job.tenantId,
      actorUserId: 'worker',
      action: 'job_completed',
      entityType: 'note',
      entityId: note.id,
      details: {
        jobId: job.id,
      },
    });

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

    return true;
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const updatedJob = store.markJobAttemptFailed(job.id, errorMessage, maxAttempts);

    if (updatedJob?.status === 'failed') {
      store.setNoteStatus(job.tenantId, job.noteId, 'failed');
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

    return true;
  }
};

export const runOnce = async (options: RunOnceOptions): Promise<number> => {
  const provider = options.provider ?? new RulesExtractionProvider();
  const logger = options.logger ?? createDefaultLogger();
  const maxJobs = options.maxJobs ?? 5;
  const maxAttempts = options.maxAttempts ?? 3;

  let processed = 0;
  while (processed < maxJobs) {
    const didProcess = processSingleJob({
      store: options.store,
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
