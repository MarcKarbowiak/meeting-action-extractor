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
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client.js';
import { useNotification } from '../context/NotificationContext.js';
import type { ApiNote, ApiTask } from '../api/types.js';

const taskStatusColors: Record<string, 'default' | 'success' | 'error'> = {
  suggested: 'default',
  approved: 'success',
  rejected: 'error',
};

type EditDialogProps = {
  open: boolean;
  task: ApiTask | null;
  onClose: () => void;
  onSave: (taskId: string, updates: { title?: string; owner?: string; dueDate?: string }) => Promise<void>;
};

const EditTaskDialog = ({ open, task, onClose, onSave }: EditDialogProps): JSX.Element => {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setOwner(task.owner || '');
      setDueDate(task.dueDate || '');
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;

    try {
      setSaving(true);
      await onSave(task.id, {
        title: title.trim() || undefined,
        owner: owner.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Task</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            disabled={saving}
          />
          <TextField
            label="Owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            fullWidth
            disabled={saving}
            placeholder="e.g., John Doe"
          />
          <TextField
            label="Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            fullWidth
            disabled={saving}
            placeholder="YYYY-MM-DD"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const NoteDetailsPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<ApiNote | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<ApiTask | null>(null);
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [noteResponse, tasksResponse] = await Promise.all([
        apiClient.getNote(id),
        apiClient.getNoteTasks(id),
      ]);
      setNote(noteResponse.note);
      setTasks(tasksResponse.tasks);
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to load note: ${error.message}`);
      } else {
        showError('Failed to load note');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refresh while note is processing
  useEffect(() => {
    if (!note) return;
    
    const isProcessing = note.status === 'submitted' || note.status === 'processing';
    if (!isProcessing) return;

    const intervalId = setInterval(() => {
      loadData();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.status]);

  const handleUpdateTaskStatus = async (taskId: string, status: 'approved' | 'rejected') => {
    try {
      await apiClient.updateTask(taskId, { status });
      showSuccess(`Task ${status}`);
      await loadData();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to update task: ${error.message}`);
      } else {
        showError('Failed to update task');
      }
    }
  };

  const handleEditTask = (task: ApiTask) => {
    setEditTask(task);
  };

  const handleSaveEdit = async (taskId: string, updates: { title?: string; owner?: string; dueDate?: string }) => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      await apiClient.updateTask(taskId, {
        status: task.status,
        ...updates,
      });
      showSuccess('Task updated');
      await loadData();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to update task: ${error.message}`);
      } else {
        showError('Failed to update task');
      }
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await apiClient.exportTasksCsv('approved');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tasks.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccess('CSV exported successfully');
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to export CSV: ${error.message}`);
      } else {
        showError('Failed to export CSV');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!note) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Note not found
        </Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/notes')} sx={{ mt: 2 }}>
          Back to Notes
        </Button>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/notes')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>
          {note.title}
        </Typography>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCsv}>
          Export CSV
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Status
        </Typography>
        <Chip label={note.status} color={taskStatusColors[note.status] || 'default'} sx={{ mb: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Meeting Notes
        </Typography>
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}
        >
          {note.rawText}
        </Typography>
      </Paper>

      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Extracted Tasks ({tasks.length})
        </Typography>

        {tasks.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {note.status === 'submitted' || note.status === 'processing'
                ? 'Processing... Tasks will appear here once extraction completes.'
                : note.status === 'failed'
                ? 'Task extraction failed. Please try submitting a new note.'
                : 'No action items found in this note. Try including keywords like ACTION:, TODO:, NEXT:, or FOLLOW UP: with specific tasks.'}
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Task</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>{task.owner || '-'}</TableCell>
                    <TableCell>{task.dueDate || '-'}</TableCell>
                    <TableCell>
                      <Chip label={task.status} color={taskStatusColors[task.status]} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditTask(task)}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {task.status !== 'approved' && (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleUpdateTaskStatus(task.id, 'approved')}
                            title="Approve"
                          >
                            <ApproveIcon fontSize="small" />
                          </IconButton>
                        )}
                        {task.status !== 'rejected' && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleUpdateTaskStatus(task.id, 'rejected')}
                            title="Reject"
                          >
                            <RejectIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <EditTaskDialog
        open={!!editTask}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSave={handleSaveEdit}
      />
    </Stack>
  );
};
