import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  Chip,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client.js';
import { useNotification } from '../context/NotificationContext.js';
import type { ApiNote } from '../api/types.js';

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

const statusColors: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  submitted: 'default',
  processing: 'info',
  ready: 'success',
  failed: 'error',
};

const NotesListPage = (): JSX.Element => {
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showError } = useNotification();

  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getNotes();
      setNotes(response.notes);
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to load notes: ${error.message}`);
      } else {
        showError('Failed to load notes');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [showError]);

  const handleRowClick = (noteId: string) => {
    navigate(`/notes/${noteId}`);
  };

  const handleNewNote = () => {
    navigate('/notes/new');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Meeting Notes</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleNewNote}>
          New Note
        </Button>
      </Box>

      {notes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No notes yet. Create your first note to get started.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleNewNote} sx={{ mt: 2 }}>
            Create Note
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notes.map((note) => (
                <TableRow
                  key={note.id}
                  hover
                  onClick={() => handleRowClick(note.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{note.title}</TableCell>
                  <TableCell>
                    <Chip label={note.status} color={statusColors[note.status] || 'default'} size="small" />
                  </TableCell>
                  <TableCell>{formatDate(note.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};

export { NotesListPage };
export default NotesListPage;
