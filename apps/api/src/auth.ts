import type { LocalJsonStore, Role } from '@meeting-action-extractor/db';

import { ApiError } from './errors.js';
import type { ApiMode, AuthContext } from './types.js';

const parseRoles = (value: string | undefined): Role[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((role) => role.trim())
    .filter((role): role is Role => role === 'admin' || role === 'member' || role === 'reader');
};

const maybe = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const buildDevFallback = (store: LocalJsonStore): AuthContext => {
  const snapshot = store.getSnapshot();
  const adminUser = snapshot.users.find((user) => user.email === 'admin@demo.local') ?? snapshot.users[0];
  if (!adminUser) {
    throw new ApiError(
      401,
      'unauthorized',
      'Missing auth headers and no fallback user found. Run pnpm store:seed.',
    );
  }

  const membership =
    snapshot.memberships.find((value) => value.userId === adminUser.id) ?? snapshot.memberships[0];

  if (!membership) {
    throw new ApiError(
      401,
      'unauthorized',
      'Missing auth headers and no fallback membership found. Run pnpm store:seed.',
    );
  }

  return {
    tenantId: membership.tenantId,
    userId: adminUser.id,
    email: adminUser.email,
    displayName: adminUser.displayName,
    roles: [membership.role],
  };
};

export const deriveAuthContext = (params: {
  headers: Record<string, string | string[] | undefined>;
  mode: ApiMode;
  store: LocalJsonStore;
}): AuthContext => {
  const { headers, mode, store } = params;

  const tenantId = maybe(headers['x-tenant-id']);
  const userId = maybe(headers['x-user-id']);
  const email = maybe(headers['x-user-email']);
  const rawRoles = maybe(headers['x-user-roles']);

  if (!tenantId || !userId || !email) {
    if (mode === 'production') {
      throw new ApiError(401, 'unauthorized', 'Missing required auth headers.');
    }

    return buildDevFallback(store);
  }

  const user = store.getUserById(userId);
  const displayName = user?.displayName ?? email.split('@')[0] ?? 'user';
  let roles = parseRoles(rawRoles);

  if (roles.length === 0) {
    const membership = store.getMembership(tenantId, userId);
    if (membership) {
      roles = [membership.role];
    }
  }

  if (roles.length === 0) {
    throw new ApiError(403, 'forbidden', 'No role mapping found for this user and tenant.');
  }

  return {
    tenantId,
    userId,
    email,
    displayName,
    roles,
  };
};
