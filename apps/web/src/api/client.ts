import type {
  ApiErrorPayload,
  MeResponse,
  NotesListResponse,
  NoteResponse,
  TasksListResponse,
  CreateNoteResponse,
  UpdateTaskResponse,
} from './types.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type DevHeaders = {
  tenantId: string;
  userId: string;
  email: string;
  roles: string; // comma-separated
};

const getBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
};

const getDevHeaders = (): DevHeaders | null => {
  try {
    const stored = localStorage.getItem('dev-context');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const buildHeaders = (includeJsonContentType = false): Record<string, string> => {
  const headers: Record<string, string> = {};

  if (includeJsonContentType) {
    headers['content-type'] = 'application/json';
  }

  const devHeaders = getDevHeaders();
  if (devHeaders) {
    headers['x-tenant-id'] = devHeaders.tenantId;
    headers['x-user-id'] = devHeaders.userId;
    headers['x-user-email'] = devHeaders.email;
    headers['x-user-roles'] = devHeaders.roles;
  }

  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let errorPayload: ApiErrorPayload;
  try {
    errorPayload = (await response.json()) as ApiErrorPayload;
  } catch {
    throw new ApiError(response.status, 'unknown_error', `HTTP ${response.status}`, undefined);
  }

  throw new ApiError(response.status, errorPayload.code, errorPayload.message, errorPayload.details);
};

export const apiClient = {
  async getMe(): Promise<MeResponse> {
    const response = await fetch(`${getBaseUrl()}/me`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse<MeResponse>(response);
  },

  async getNotes(limit?: number, offset?: number): Promise<NotesListResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));

    const query = params.toString();
    const url = `${getBaseUrl()}/notes${query ? `?${query}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse<NotesListResponse>(response);
  },

  async getNote(id: string): Promise<NoteResponse> {
    const response = await fetch(`${getBaseUrl()}/notes/${id}`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse<NoteResponse>(response);
  },

  async getNoteTasks(noteId: string): Promise<TasksListResponse> {
    const response = await fetch(`${getBaseUrl()}/notes/${noteId}/tasks`, {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse<TasksListResponse>(response);
  },

  async createNote(data: { title: string; rawText: string }): Promise<CreateNoteResponse> {
    const response = await fetch(`${getBaseUrl()}/notes`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return handleResponse<CreateNoteResponse>(response);
  },

  async deleteNote(noteId: string): Promise<{ deleted: boolean; noteId: string }> {
    const response = await fetch(`${getBaseUrl()}/notes/${noteId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });

    return handleResponse<{ deleted: boolean; noteId: string }>(response);
  },

  async updateTask(taskId: string, data: {
    status: 'suggested' | 'approved' | 'rejected';
    title?: string;
    owner?: string;
    dueDate?: string;
  }): Promise<UpdateTaskResponse> {
    const response = await fetch(`${getBaseUrl()}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return handleResponse<UpdateTaskResponse>(response);
  },

  async exportTasksCsv(status?: 'suggested' | 'approved' | 'rejected'): Promise<Blob> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);

    const query = params.toString();
    const url = `${getBaseUrl()}/tasks/export.csv${query ? `?${query}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    });

    if (!response.ok) {
      // Try to parse error as JSON first
      let errorPayload: ApiErrorPayload;
      try {
        errorPayload = (await response.json()) as ApiErrorPayload;
        throw new ApiError(response.status, errorPayload.code, errorPayload.message, errorPayload.details);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(response.status, 'unknown_error', `HTTP ${response.status}`, undefined);
      }
    }

    return response.blob();
  },
};
