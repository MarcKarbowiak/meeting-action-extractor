import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext.js';
import { Layout } from './components/Layout.js';
import NotesListPage from './pages/NotesListPage.js';
import { NewNotePage } from './pages/NewNotePage.js';
import { NoteDetailsPage } from './pages/NoteDetailsPage.js';

export const App = (): JSX.Element => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/notes" replace />} />
            <Route path="notes" element={<NotesListPage />} />
            <Route path="notes/new" element={<NewNotePage />} />
            <Route path="notes/:id" element={<NoteDetailsPage />} />
          </Route>
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
};
