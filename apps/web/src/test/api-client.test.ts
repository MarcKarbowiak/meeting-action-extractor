import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../api/client.js';

describe('API Client', () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    // Mock localStorage
    const storage: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        Object.keys(storage).forEach((key) => delete storage[key]);
      },
      key: (index: number) => Object.keys(storage)[index] || null,
      length: Object.keys(storage).length,
    };
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
  });

  it('should inject dev headers from localStorage', async () => {
    const devContext = {
      tenantId: 'tenant-test-001',
      userId: 'user-test-001',
      email: 'test@example.com',
      roles: 'admin,member',
    };

    localStorage.setItem('dev-context', JSON.stringify(devContext));

    // Mock fetch to capture headers
    let capturedHeaders: Record<string, string> = {};
    const originalFetch = global.fetch;
    global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.headers) {
        capturedHeaders = init.headers as Record<string, string>;
      }
      // Return mock response
      return {
        ok: true,
        json: async () => ({ notes: [] }),
      } as Response;
    };

    try {
      await apiClient.getNotes();

      expect(capturedHeaders['x-tenant-id']).toBe('tenant-test-001');
      expect(capturedHeaders['x-user-id']).toBe('user-test-001');
      expect(capturedHeaders['x-user-email']).toBe('test@example.com');
      expect(capturedHeaders['x-user-roles']).toBe('admin,member');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should not inject headers if dev context is missing', async () => {
    localStorage.removeItem('dev-context');

    let capturedHeaders: Record<string, string> = {};
    const originalFetch = global.fetch;
    global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.headers) {
        capturedHeaders = init.headers as Record<string, string>;
      }
      return {
        ok: true,
        json: async () => ({ notes: [] }),
      } as Response;
    };

    try {
      await apiClient.getNotes();

      expect(capturedHeaders['x-tenant-id']).toBeUndefined();
      expect(capturedHeaders['x-user-id']).toBeUndefined();
      expect(capturedHeaders['content-type']).toBe('application/json');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
