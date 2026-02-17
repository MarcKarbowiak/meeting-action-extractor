import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '../context/NotificationContext.js';
import { NotesListPage } from '../pages/NotesListPage.js';

const getNotesMock = vi.fn();
const deleteNoteMock = vi.fn();

// Mock API client
vi.mock('../api/client.js', () => ({
  apiClient: {
    getNotes: (...args: unknown[]) => getNotesMock(...args),
    deleteNote: (...args: unknown[]) => deleteNoteMock(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
      public details?: unknown,
    ) {
      super(message);
    }
  },
}));

describe('NotesListPage', () => {
  beforeEach(() => {
    getNotesMock.mockReset();
    deleteNoteMock.mockReset();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render without crashing', async () => {
    getNotesMock.mockResolvedValue({ notes: [] });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotificationProvider>
          <NotesListPage />
        </NotificationProvider>
      </BrowserRouter>,
    );

    // Wait for loading to complete and check for "Meeting Notes" heading
    const heading = await screen.findByText(/Meeting Notes/i);
    expect(heading).toBeDefined();
  });

  it('deletes a note after confirmation and does not navigate', async () => {
    const note = {
      id: 'note-1',
      tenantId: 'tenant-demo',
      title: 'Quarterly planning',
      rawText: 'ACTION: do thing',
      status: 'ready',
      createdBy: 'user-member-demo',
      createdAt: new Date('2026-02-16T12:00:00.000Z').toISOString(),
    };

    getNotesMock
      .mockResolvedValueOnce({ notes: [note] })
      .mockResolvedValueOnce({ notes: [] });
    deleteNoteMock.mockResolvedValue({ deleted: true, noteId: note.id });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotificationProvider>
          <NotesListPage />
        </NotificationProvider>
      </BrowserRouter>,
    );

    await screen.findByText('Quarterly planning');
    expect(window.location.pathname).toBe('/');

    fireEvent.click(screen.getByLabelText(/delete meeting note/i));

    expect(deleteNoteMock).toHaveBeenCalledTimes(1);
    expect(deleteNoteMock).toHaveBeenCalledWith('note-1');

    const toast = await screen.findByText(/Meeting note deleted/i);
    expect(toast).toBeDefined();

    const empty = await screen.findByText(/No notes yet\. Create your first note to get started\./i);
    expect(empty).toBeDefined();
    expect(window.location.pathname).toBe('/');
  });

  it('navigates to note detail when clicking a row', async () => {
    const note = {
      id: 'note-2',
      tenantId: 'tenant-demo',
      title: 'Weekly sync',
      rawText: 'Notes',
      status: 'ready',
      createdBy: 'user-member-demo',
      createdAt: new Date('2026-02-16T12:00:00.000Z').toISOString(),
    };

    getNotesMock.mockResolvedValue({ notes: [note] });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotificationProvider>
          <NotesListPage />
        </NotificationProvider>
      </BrowserRouter>,
    );

    const rowText = await screen.findByText('Weekly sync');
    fireEvent.click(rowText);

    expect(window.location.pathname).toBe('/notes/note-2');
  });
});
