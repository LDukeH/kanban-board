# Kanban Board

A workspace-centric Kanban board built with **React 19, TypeScript, Vite and Tailwind CSS v4**.
It consumes the Go Kanban API (`/api/v1`) over JSON.

## Stack

- **React 19** + TypeScript (frontend)
- **Vite 8** (build tool) + Tailwind CSS v4
- **TanStack Query** (server-state cache / mutations)
- **Zustand** with `persist` middleware (UI stores, e.g. theme, selected workspace, recents)
- **@dnd-kit/react** (drag & drop for columns and tasks)
- **@base-ui/react** (accessible primitives: dialogs, dropdowns, buttons)
- **lucide-react** icons, `zod` schemas for form validation

## Setup

```bash
npm install
```

Create a `.env` file at the repository root with the API base URL:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## Development

```bash
npm run dev       # start the Vite dev server with HMR
npm run build     # type-check (tsc -b) then produce a production build in dist/
npm run lint      # run ESLint
npm run preview   # serve the production build locally
```

The dev server proxies API calls through the configured `VITE_API_URL`. Authentication
is cookie-based (HTTP-only cookie), which is why the API client uses `withCredentials: true`.

## Project layout

```text
src/
  components/       UI components, grouped by feature (auth, board, dashboard, workspace, ...)
  hooks/            TanStack Query hooks per resource (useWorkspaces, useBoard, ...)
  lib/
    api/            HTTP boundary: axios client + snake_case ? camelCase mapping
    validations/    zod schemas shared by forms
  pages/            One component per route (BoardPage, WorkspacePage, ...)
  routes/           GuestRoute / ProtectedRoute wrappers
  stores/           Zustand stores (theme, selected workspace, recently accessed)
  types/            Frontend (camelCase) row types
```

### API boundary

The `src/lib/api` modules are the only place that talks to the backend. Backend
responses use `snake_case`; these modules map them to the `camelCase` types in
`src/types` before they reach hooks/components.

## Routes

| Path                          | Page              |
| ----------------------------- | ----------------- |
| `/auth`                       | login / register  |
| `/workspaces`                 | all workspaces   |
| `/workspaces/:workspaceId`    | workspace boards |
| `/boards/:boardId`            | kanban board     |
| `/settings`                   | account & theme  |