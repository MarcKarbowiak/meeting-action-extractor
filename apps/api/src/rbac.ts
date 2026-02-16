import type { Role } from '@meeting-action-extractor/db';

import { ApiError } from './errors.js';
import type { AuthContext } from './types.js';

const hasRole = (roles: Role[], wanted: Role): boolean => {
  return roles.includes(wanted);
};

export const requireRole = (auth: AuthContext, wanted: 'member' | 'admin'): void => {
  if (wanted === 'admin') {
    if (!hasRole(auth.roles, 'admin')) {
      throw new ApiError(403, 'forbidden', 'Admin role is required.');
    }

    return;
  }

  if (!hasRole(auth.roles, 'member') && !hasRole(auth.roles, 'admin')) {
    throw new ApiError(403, 'forbidden', 'Member or admin role is required.');
  }
};

export const enforceReaderWriteRestriction = (auth: AuthContext, method: string): void => {
  if (method.toUpperCase() === 'GET') {
    return;
  }

  if (hasRole(auth.roles, 'member') || hasRole(auth.roles, 'admin')) {
    return;
  }

  throw new ApiError(403, 'forbidden', 'Reader role is restricted to GET endpoints.');
};
