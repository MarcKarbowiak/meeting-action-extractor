import { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Stack, CircularProgress } from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client.js';
import { useNotification } from '../context/NotificationContext.js';

export const NewNotePage = (): JSX.Element => {
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !rawText.trim()) {
      showError('Title and content are required');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.createNote({
        title: title.trim(),
        rawText: rawText.trim(),
      });
      showSuccess('Note created successfully');
      navigate(`/notes/${response.note.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to create note: ${error.message}`);
      } else {
        showError('Failed to create note');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/notes');
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        New Meeting Note
      </Typography>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              disabled={loading}
              placeholder="e.g., Weekly Team Sync - Feb 16, 2026"
            />

            <TextField
              label="Meeting Notes"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              fullWidth
              required
              multiline
              rows={12}
              disabled={loading}
              placeholder={`Enter your meeting notes here. Include any action items with keywords like:
- ACTION: Task description
- TODO: Task description
- NEXT: Task description

You can also specify owners like "@John" and due dates in YYYY-MM-DD format.`}
            />

            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Note'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
};
