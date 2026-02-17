export type DevContext = {
  tenantId: string;
  userId: string;
  email: string;
  roles: string;
  allowDeleteNotes?: boolean;
};

const DEFAULT_CONTEXT: DevContext = {
  tenantId: '',
  userId: '',
  email: '',
  roles: 'member',
  allowDeleteNotes: false,
};

export const loadDevContext = (): DevContext => {
  try {
    const stored = localStorage.getItem('dev-context');
    if (stored) {
      const parsed = JSON.parse(stored) as DevContext;
      return {
        ...DEFAULT_CONTEXT,
        ...parsed,
      };
    }
  } catch {
    return DEFAULT_CONTEXT;
  }

  return DEFAULT_CONTEXT;
};

export const parseRoles = (roles: string): string[] => {
  return roles
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);
};

export const hasAdminRole = (context: DevContext): boolean => {
  return parseRoles(context.roles).includes('admin');
};

export const getFeatureFlagsHeader = (context: DevContext): string | undefined => {
  const flags: string[] = [];

  if (context.allowDeleteNotes) {
    flags.push('notes.allowDelete=true');
  }

  return flags.length > 0 ? flags.join(',') : undefined;
};
