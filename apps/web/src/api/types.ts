import type { Note, Task, Role } from '@meeting-action-extractor/db';

// API Response Types
export type ApiNote = Note;
export type ApiTask = Task;

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  tenantId: string;
  roles: Role[];
};

export type NotesListResponse = {
  notes: ApiNote[];
};

export type NoteResponse = {
  note: ApiNote;
};

export type TasksListResponse = {
  tasks: ApiTask[];
};

export type CreateNoteResponse = {
  note: ApiNote;
  job: {
    id: string;
    tenantId: string;
    noteId: string;
    status: string;
    attempts: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateTaskResponse = {
  task: ApiTask;
};
