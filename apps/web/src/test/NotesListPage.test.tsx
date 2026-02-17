import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '../context/NotificationContext.js';
import { NotesListPage } from '../pages/NotesListPage.js';

const getNotesMock = vi.fn();

// Mock API client
vi.mock('../api/client.js', () => ({
  apiClient: {
    getNotes: (...args: unknown[]) => getNotesMock(...args),
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
