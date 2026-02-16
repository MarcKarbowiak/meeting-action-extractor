import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from '../context/NotificationContext.js';
import { NotesListPage } from '../pages/NotesListPage.js';

// Mock API client
vi.mock('../api/client.js', () => ({
  apiClient: {
    getNotes: async () => ({ notes: [] }),
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
  it('should render without crashing', async () => {
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
});
