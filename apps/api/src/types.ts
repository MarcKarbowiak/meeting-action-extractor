import type { Role } from '@meeting-action-extractor/db';

export type AuthContext = {
  tenantId: string;
  userId: string;
  email: string;
  displayName: string;
  roles: Role[];
};

export type ApiMode = 'production' | 'development' | 'test';
