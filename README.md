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
| HTTP           | axios (Supabase Auth Bearer token)                                  |

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
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
```

Enable hCaptcha in the Supabase dashboard under **Authentication → Bot and
Abuse Protection**, configure the hCaptcha secret key there, and add the
corresponding site key to `VITE_HCAPTCHA_SITE_KEY`. The sign-in, sign-up, and
password-reset forms send the challenge token to Supabase Auth.

`VITE_API_URL` is read by the axios client (`src/lib/api/axios.ts`) and used
verbatim as the base URL. Supabase Auth manages the browser session and axios
sends its access token as an `Authorization: Bearer` header to the Go API.

The password-reset email returns to `/auth/reset-password`. Add the local and
production URLs (for example, `http://localhost:5173/auth/reset-password`) to
the Supabase project's **Authentication → URL Configuration → Redirect URLs**.

### Password-reset email delivery

`resetPasswordForEmail` returning successfully (and an Auth `/recover` log with
status `200`) means Supabase accepted the request; it does not guarantee that
an email reached the recipient. Before testing password reset:

1. In **Authentication → Providers → Email**, enable email/password auth.
2. In **Authentication → SMTP Settings**, configure a custom SMTP provider for
   recipients outside the Supabase project team. The built-in Supabase email
   service is intended for testing, is heavily rate-limited, and can silently
   fail to deliver to arbitrary recipients.
3. In **Authentication → Email Templates → Reset Password**, verify the
   template is enabled and check that the sender address/domain is valid.
4. Check the provider's delivery logs and the recipient's spam folder.

The application intentionally shows a generic success message after the
request, so it does not reveal whether an email address belongs to an account.

If signup fails with `POST /auth/v1/signup` and HTTP `500`, inspect the
Supabase Auth log's `error`/`msg` field. Messages such as `Error sending
confirmation email` or `Database error saving new user` indicate a Supabase
project configuration/service problem, not an API request from this frontend:
verify custom SMTP credentials and sender/domain settings, then retry after
checking the SMTP provider logs. The publishable key and URL in the frontend
must also belong to the same Supabase project.

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
| `/auth`                       | login / register / request password reset |
| `/auth/reset-password`        | choose a new password from an email link |
| `/workspaces`                 | all workspaces   |
| `/workspaces/:workspaceId`    | workspace boards |
| `/boards/:boardId`            | kanban board     |
| `/settings`                   | account & theme  |