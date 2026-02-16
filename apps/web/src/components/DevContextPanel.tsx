import { useState, useEffect } from 'react';
import { Box, Paper, TextField, Stack, Typography, Collapse, IconButton } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

type DevContext = {
  tenantId: string;
  userId: string;
  email: string;
  roles: string;
};

const loadDevContext = (): DevContext => {
  try {
    const stored = localStorage.getItem('dev-context');
    if (stored) {
      return JSON.parse(stored) as DevContext;
    }
  } catch {
    // ignore
  }

  return {
    tenantId: '',
    userId: '',
    email: '',
    roles: 'member',
  };
};

export const DevContextPanel = (): JSX.Element => {
  const [context, setContext] = useState<DevContext>(loadDevContext);
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('dev-context', JSON.stringify(context));
  }, [context]);

  const handleChange = (field: keyof DevContext) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setContext({
      ...context,
      [field]: event.target.value,
    });
  };

  return (
    <Paper sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Dev Auth Context
        </Typography>
        <IconButton
          size="small"
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: '0.3s',
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Tenant ID"
              value={context.tenantId}
              onChange={handleChange('tenantId')}
              fullWidth
              size="small"
              placeholder="tenant-demo"
            />
            <TextField
              label="User ID"
              value={context.userId}
              onChange={handleChange('userId')}
              fullWidth
              size="small"
              placeholder="user-admin-demo"
            />
            <TextField
              label="Email"
              value={context.email}
              onChange={handleChange('email')}
              fullWidth
              size="small"
              placeholder="admin@demo.local"
            />
            <TextField
              label="Roles (comma-separated)"
              value={context.roles}
              onChange={handleChange('roles')}
              fullWidth
              size="small"
              placeholder="admin,member"
            />
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
