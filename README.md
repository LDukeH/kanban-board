# Kanban Board

A workspace-centric Kanban board built with **React 19, TypeScript, Vite and Tailwind CSS v4**.
It consumes the Go Kanban API over JSON.

## Stack

| Area           | Technology                                                          |
| -------------- | ------------------------------------------------------------------- |
| UI             | React 19 + TypeScript 6                                             |
| Build tooling  | Vite 8 + Tailwind CSS v4 (`@tailwindcss/vite`), React Compiler      |
| Routing        | react-router-dom (v7)                                               |
| Server state   | TanStack Query (query cache + mutations)                            |
| UI state       | Zustand stores (`persist`: theme, selected workspace; recents scoped per account) |
| Forms & schema | react-hook-form + zod                                               |
| Drag & drop    | @dnd-kit/react (columns and tasks)                                  |
| UI kit         | @base-ui/react + shadcn `ui/` primitives, lucide-react icons, motion |
| HTTP           | axios (cookie credentials via `withCredentials`)                    |

## Requirements

- **Node.js `^20.19.0` or `>=22.12.0`** — Vite 8's engine requirement.
- A running instance of the Go Kanban API backend (the frontend does not mock it).

## Install

```bash
npm install
```

## Configuration

Create a `.env` file at the repository root (it is gitignored and never committed):

```env
VITE_API_URL=http://localhost:3000
```

`VITE_API_URL` is read by the axios client (`src/lib/api/axios.ts`) and used
verbatim as the base URL — point it at the backend and include any `/api/v1`
prefix the backend is mounted under. Auth is cookie-based (HTTP-only cookie),
which is why the client sets `withCredentials: true`.

## Development

```bash
npm run dev       # start the Vite dev server with HMR
npm run build     # type-check (tsc -b) then produce a production build in dist/
npm run lint      # run ESLint
npm run preview   # serve the production build locally
```

There is no dev-server proxy: the frontend calls the API directly over CORS,
using the base URL from `VITE_API_URL`.

## Project layout

```text
index.html           Vite entry point
vite.config.ts       Vite + Tailwind + React Compiler plugins; "@" -> ./src alias
components.json      shadcn registry (components/ui, lib/utils, hooks aliases)
eslint.config.js     ESLint flat config
tsconfig*.json       TypeScript configs (app / node / references)
public/              Static assets copied verbatim into dist/ (favicon, icons)
dist/                Production build output (gitignored)
src/
  main.tsx           App entry: QueryClientProvider, BrowserRouter, store bootstrap
  App.tsx            Route definitions + page-transition wrapper
  index.css          Tailwind v4 entry (imports shadcn, tw-animate-css, Geist font)
  assets/            Static images imported by components
  components/        UI components, grouped by feature
    auth/            login/register forms, OAuth buttons
    board/           columns, task cards, labels, dialogs
    dashboard/       board cards/grid, featured section
    layout/          sidebar, dashboard layout
    ui/              shadcn-style primitives (button, dialog, input, ...)
    workspace/       workspace/board CRUD + member dialogs
  hooks/             TanStack Query hooks per resource (useWorkspaces, useBoard, ...)
  lib/
    api/             HTTP boundary: axios client + snake_case -> camelCase mapping
    validations/     zod schemas shared by forms
    ...              shared helpers (colors, httpStatus, taskFilter, utils, queryClient)
  pages/             One component per route (BoardPage, WorkspacePage, ...)
  routes/            GuestRoute / ProtectedRoute wrappers
  stores/            Zustand stores (theme, selected workspace, recently accessed)
  types/             Frontend (camelCase) row types
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