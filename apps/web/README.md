# Web App

React + MUI web interface for Meeting Action Extractor.

## Tech Stack

- React 18.3
- TypeScript (strict mode)
- Vite 5.4
- Material-UI (MUI) v5.18
- React Router v6.30
- Vitest + React Testing Library

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

Vite will start at http://localhost:5173

### Build for Production

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

## Configuration

### API Base URL

Set via environment variable:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

Default: `http://localhost:3000`

### Dev Authentication Context

The app uses localStorage to persist dev auth headers:

- Tenant ID
- User ID
- Email
- Roles (comma-separated)

These are injected as headers (`x-tenant-id`, `x-user-id`, `x-user-email`, `x-user-roles`) on every API request.

Use the **Dev Context Panel** at the top of the page to configure.

## Features

### Pages

1. **Notes List** (`/notes`)
   - View all meeting notes
   - Status badges (submitted, processing, ready, failed)
   - Click to view details
   - "New Note" button

2. **New Note** (`/notes/new`)
   - Title input
   - Multiline note content
   - Submit to create note and enqueue extraction job

3. **Note Details** (`/notes/:id`)
   - View note content and status
   - View extracted tasks in a table
   - Approve/Reject/Edit tasks inline
   - Export approved tasks as CSV

### Layout Guidelines (MUI)

This app follows strict MUI layout guidelines:

- **Prefer Stack/Box** for layout over Grid
- **Use Grid2** only for true multi-column responsive layouts
- **No deprecated system props** (e.g., `p={2}`, `mt={2}`)
- **Use `sx={{...}}` for styling**

## Architecture

### API Client

- **File**: `src/api/client.ts`
- Centralized fetch wrapper
- Auto-injects dev headers from localStorage
- Structured error handling with `ApiError` class

### Context Providers

- **NotificationContext**: Global snackbar for success/error messages
- **DevContextPanel**: Component to manage dev auth headers

### Routing

React Router v6 with nested routes:

```
/ → Layout (with DevContextPanel)
  /notes → NotesListPage
  /notes/new → NewNotePage
  /notes/:id → NoteDetailsPage
```

### State Management

Uses React local state (`useState`, `useEffect`) - no global state library.

## Testing

- `src/test/api-client.test.ts` - Unit tests for header injection
- `src/test/NotesListPage.test.tsx` - Smoke test for page rendering

Run with:

```bash
pnpm test
```

## Validation

Lint, typecheck, and test before committing:

```bash
pnpm lint && pnpm typecheck && pnpm test
```
