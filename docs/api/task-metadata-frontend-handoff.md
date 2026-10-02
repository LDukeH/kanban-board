# Task Metadata — Frontend Handoff

Tasks now carry planning metadata: `priority`, `due_date`, and `completed`.
Migration `019_add_task_metadata.sql` is applied (columns + `tasks_priority_check`
+ `idx_tasks_column_id_due_date`). No new endpoint was added. Use the existing
task create/update/list routes.

There is no `/api/v1` prefix in this backend — all routes are served from the root
(`/columns`, `/tasks`, ...). The server runs on port `3000`.

All routes require the authenticated `access_token` cookie. Use the shared Axios
client with `withCredentials: true`; do not send a manual `Authorization` header.

All request and response fields are `snake_case`.

## Task shape (new keys)

```json
{
  "id": "f1e2d3c4-b5a6-4798-9e0f-abcd12345678",
  "column_id": "a1b2c3d4-e5f6-4798-9e0f-abcd12345678",
  "title": "Ship onboarding",
  "description": null,
  "position": 0,
  "priority": "high",
  "due_date": "2026-10-02",
  "completed": false,
  "created_at": "2026-10-02T12:00:00Z",
  "updated_at": "2026-10-02T12:00:00Z",
  "labels": [],
  "assignees": []
}
```

| Field       | Type               | Stored as                        | Response                                      |
| ----------- | ------------------ | -------------------------------- | --------------------------------------------- |
| `priority`  | `string`           | `TEXT NOT NULL DEFAULT 'none'`   | Always present: `none`/`low`/`medium`/`high`  |
| `due_date`  | `string` \| `null` | `DATE NULL`                      | `YYYY-MM-DD` or `null`; never absent           |
| `completed` | `boolean`          | `BOOLEAN NOT NULL DEFAULT false` | Always present                                |

`priority` and `completed` are never `null` in a response. A task without a due
date reads back as `"due_date": null`.

## Create a task with metadata

```http
POST /columns/{columnID}/tasks/
Content-Type: application/json
```

```json
{
  "title": "Ship onboarding",
  "priority": "high",
  "due_date": "2026-10-02",
  "completed": false
}
```

| Field       | Required | Notes                                                  |
| ----------- | -------- | ------------------------------------------------------ |
| `title`     | yes      | Empty or missing returns `400`.                        |
| `priority`  | no       | Omitting it stores `'none'` (the DB default).          |

## Update a task (partial)

```http
PATCH /tasks/{taskID}
Content-Type: application/json
```

```json
{
  "priority": "low",
  "due_date": null,
  "completed": true
}
```

Every key is optional. `title`/`description` keep the old pointer semantics.

`due_date` is tri-state — it is the only field where `null` and "absent" differ:

| Body                       | Result                                |
| -------------------------- | ------------------------------------- |
| `due_date` omitted         | Stored value is left unchanged        |
| `"due_date": null`         | Clears the date (`SET due_date = NULL`) |
| `"due_date": "2026-10-02"` | Sets the date                         |

`priority: null` and `completed: null` behave like an omitted key (unchanged);
they never write `NULL` because the columns are `NOT NULL`.

Returns `204 No Content` — there is no response body. Re-fetch the column list
(`GET /columns/{id}/tasks/`) or apply the sent patch to the local cache.

## Validation and errors

`priority` is validated in the service layer before touching the database, so an
invalid value is a `400`, not a `500`:

| Status | Message                                   | Meaning                                                |
| ------ | ----------------------------------------- | ------------------------------------------------------ |
| `400`  | `Task title is required`                  | `title` missing or empty on create.                    |
| `400`  | `Invalid task data`                       | Body is malformed JSON, or `due_date` is not a `YYYY-MM-DD` string. |
| `400`  | `validation failed: invalid priority "x"` | `priority` is not one of `none`/`low`/`medium`/`high`. |
| `401`  | `Unauthorized`                            | No authenticated user in the request context.          |
| `403`  | `forbidden`                               | Caller is not a member of the workspace.               |

`due_date` accepts calendar dates only (`2006-01-02`). An RFC 3339 timestamp
(`2026-10-02T00:00:00Z`) is rejected with `400`; strip the time part
client-side. A non-existent calendar date (`2026-02-30`) is likewise rejected.

All errors are plain-text `http.Error` responses (not JSON). Detect failure by
status code and surface the message.

## Permissions (unchanged)

No role change ships with this feature:

| Operation                | Owner | Admin | Member     | Outsider |
| ------------------------ | ----- | ----- | ---------- | -------- |
| Create task (+ metadata) | yes   | yes   | yes        | 403      |
| Update task (+ metadata) | yes   | yes   | yes        | 403      |
| Move task (`PATCH /tasks/{id}/position`) | yes | yes | yes | 403 |
| Delete task              | yes   | yes   | **no (403)** | 403    |

A `Member` can set `priority`/`due_date`/`completed` exactly like an `Owner`;
`Member` still cannot delete. Gate bulk-delete UI on the existing
`useWorkspaceAccess` role flag and still handle per-row `403` defensively.


## Frontend checklist

- Map the new keys in the existing snake_case -> camelCase mappers; do not let
  the raw API fields leak past `src/lib/api/`.
- `priority` is a closed union: `"none" | "low" | "medium" | "high"`. Reject
  anything else client-side before sending (the backend answers `400`).
- `due_date` is `YYYY-MM-DD` or `null`. Use `<input type="date">` value
  directly; never send an ISO timestamp.
- To clear a due date, send `"due_date": null`. To leave it unchanged, omit the
  key entirely — this includes the create dialog (omitted stays `NULL`).
- `PATCH` returns `204` with no body: after a successful patch, either re-fetch
  the column query or merge the sent fields into the cached task.
- Render overdue/completed states with a non-colour-only indicator (text or
  icon), not colour alone.

## Deferred: cross-workspace search (Feature 1 proposal, not implemented)

There is deliberately **no** search endpoint yet. When it is built, the proposed
contract is:

```http
GET /search/tasks?q=onboarding&limit=20&cursor=<opaque>
```

| Param           | Notes                                                              |
| --------------- | ------------------------------------------------------------------ |
| `q`             | Required, trimmed, min 2 chars (`400` below that). Matched against task `title` (trigram/ILIKE) and, if cheap, the Tiptap `description` text. |
| `workspace_ids` | Optional repeat param. Restricts to those workspaces; unknown/inaccessible IDs are silently ignored (never `404`, so membership is not leaked). |
| `limit`         | Default 20, max 50.                                                |
| `cursor`        | Opaque cursor for keyset pagination (`updated_at, id`).            |

Response `200`:

```json
{
  "items": [
    {
      "id": "f1e2d3c4-b5a6-4798-9e0f-abcd12345678",
      "title": "Ship onboarding",
      "priority": "high",
      "due_date": "2026-10-02",
      "completed": false,
      "column_id": "a1b2c3d4-e5f6-4798-9e0f-abcd12345678",
      "column_name": "Todo",
      "board_id": "b1c2d3e4-f5a6-4798-9e0f-abcd12345678",
      "board_name": "Platform",
      "workspace_id": "c1d2e3f4-a5b6-4798-9e0f-abcd12345678",
      "workspace_name": "Engineering",
      "updated_at": "2026-10-02T12:00:00Z"
    }
  ],
  "next_cursor": null
}
```

Permission scoping: results are restricted to workspaces where the caller holds
`owner`/`admin`/`member` (one join through `workspace_memberships`, same pattern
as the `authz.Resolver`). No role distinctions beyond membership; a non-member
workspace's tasks never appear, and the endpoint returns `401` without a session
rather than an empty list.

## Read paths

All three task-returning queries include the new columns:

- `GET /columns/{columnID}/tasks/` — each entry carries `priority`, `due_date`,
  `completed` alongside the existing aggregated `labels`/`assignees`.
- `POST /columns/{columnID}/tasks/` — the `201` body carries them.
- Position/move flows re-read through the same scans, so moved tasks keep them.

Filtering stays client-side: no filter endpoint was added. Filter over the
already-fetched column tasks (URL-backed, as today).

| `due_date`  | no       | Absent or `null` both store `NULL`. `YYYY-MM-DD` only. |
| `completed` | no       | Omitting it stores `false` (the DB default).           |

Returns `201` with the created task, including the three new keys — no extra GET
is needed. `position` is still assigned server-side (`MAX(position) + 1`).
