import { AppBar, Toolbar, Typography, Container, Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { DevContextPanel } from '../components/DevContextPanel.js';
import { getFlag } from '@meeting-action-extractor/shared';

export const Layout = (): JSX.Element => {
  const showDevContextPanel =
    getFlag('ui.devContextPanel', {
      environment: import.meta.env.PROD ? 'production' : 'local',
      envFlags: {},
      headerFlags: {},
    }) === true;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Meeting Action Extractor
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4, flex: 1 }}>
        {showDevContextPanel && <DevContextPanel />}
        <Outlet />
      </Container>
    </Box>
  );
};
