import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Column, Task } from "@/types/board";
import { createColumn } from "@/lib/api/column.api";
import { textToTaskDescription } from "@/lib/description";
import { addLabelToTask, createLabel, removeLabelFromTask } from "@/lib/api/label.api";
import {
  assignUserToTask,
  createTask,
  deleteTask,
  findBoardIdForTask,
  getColumnTasks,
  getTaskAssignees,
  unassignUserFromTask,
  updateTask,
  updateTaskPosition,
} from "@/lib/api/task.api";
import { createMembership } from "@/lib/api/workspace.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import {
  actingAs,
  installSessionManager,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";
import { uniqueName } from "./helpers/uniq";

describe("live task API", () => {
  let chain: ProvisionedChain;
  let doneColumn: Column;
  let colleague: LiveAccount;
  let createdTask: Task;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();

    colleague = await provisionUser("task-colleague");
    chain = await provisionChain("task");

    await actingAs(chain.owner, async () => {
      doneColumn = await createColumn(chain.board.id, { name: "Done" });
      await createMembership(chain.workspace.id, { email: colleague.email, role: "member" });
    });
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    await tearDownChain(chain);
  });

  it("creates a task with a Tiptap description", async () => {
    const description = textToTaskDescription("A live description");
    const task = await actingAs(chain.owner, async () =>
      createTask(chain.columns[0].id, { title: uniqueName("Live task"), description }),
    );

    expect(task.id).toMatch(UUID_RE);
    expect(task.columnId).toBe(chain.columns[0].id);
    expect(task.labels).toEqual([]);
    expect(task.assignees).toEqual([]);
    expect(task.description).toEqual(description);
    createdTask = task;
  });

  it("lists column tasks and resolves the owning board", async () => {
    await actingAs(chain.owner, async () => {
      const tasks = await getColumnTasks(chain.columns[0].id);
      expect(tasks.map((t) => t.id)).toContain(createdTask.id);

      const boardId = await findBoardIdForTask(createdTask.id);
      expect(boardId).toBe(chain.board.id);
    });
  });

  it("updates a task title and description", async () => {
    await actingAs(chain.owner, async () => {
      const task = await createTask(chain.columns[0].id, { title: "Before update" });
      const description = textToTaskDescription("Updated description");

      await updateTask(task.id, { title: "After update", description });

      const updated = (await getColumnTasks(chain.columns[0].id)).find((t) => t.id === task.id);
      expect(updated?.title).toBe("After update");
      expect(updated?.description).toEqual(description);
    });
  });

  it("persists task reordering inside a column", async () => {
    await actingAs(chain.owner, async () => {
      const t1 = await createTask(chain.columns[0].id, { title: "T1" });
      const t2 = await createTask(chain.columns[0].id, { title: "T2" });
      const t3 = await createTask(chain.columns[0].id, { title: "T3" });

      await updateTaskPosition(t3.id, { columnId: chain.columns[0].id, position: 0 });

      const tasks = await getColumnTasks(chain.columns[0].id);
      const order = tasks
        .filter((t) => [t1.id, t2.id, t3.id].includes(t.id))
        .map((t) => t.id);
      expect(order).toEqual([t3.id, t1.id, t2.id]);
    });
  });

  it("moves a task to another column", async () => {
    await actingAs(chain.owner, async () => {
      const task = await createTask(chain.columns[0].id, { title: "Mover" });

      await updateTaskPosition(task.id, { columnId: doneColumn.id, position: 0 });

      const source = await getColumnTasks(chain.columns[0].id);
      const target = await getColumnTasks(doneColumn.id);
      expect(source.map((t) => t.id)).not.toContain(task.id);
      expect(target.map((t) => t.id)).toContain(task.id);
    });
  });

  it("assigns a workspace member who can unassign themself", async () => {
    const task = await actingAs(chain.owner, async () => {
      const t = await createTask(chain.columns[0].id, { title: "Assigned task" });
      await assignUserToTask(t.id, colleague.id);
      return t;
    });

    await actingAs(chain.owner, async () => {
      const assignees = await getTaskAssignees(task.id);
      expect(assignees.map((a) => a.user_id)).toContain(colleague.id);
    });

    await actingAs(colleague, async () => {
      await unassignUserFromTask(task.id, colleague.id);
      const assignees = await getTaskAssignees(task.id);
      expect(assignees.map((a) => a.user_id)).not.toContain(colleague.id);
    });
  });

  it("attaches and detaches a label to a task", async () => {
    await actingAs(chain.owner, async () => {
      const label = await createLabel(chain.board.id, { name: "Bug", color: "#e11941" });
      const task = await createTask(chain.columns[0].id, { title: "Labeled task" });

      await addLabelToTask(task.id, label.id);
      const withLabel = (await getColumnTasks(chain.columns[0].id)).find((t) => t.id === task.id);
      expect(withLabel?.labels?.map((l) => l.id)).toContain(label.id);

      await removeLabelFromTask(task.id, label.id);
      const withoutLabel = (await getColumnTasks(chain.columns[0].id)).find((t) => t.id === task.id);
      expect(withoutLabel?.labels?.map((l) => l.id)).not.toContain(label.id);
    });
  });

  it("deletes a task", async () => {
    await actingAs(chain.owner, async () => {
      const task = await createTask(chain.columns[0].id, { title: "Doomed task" });

      await deleteTask(task.id);

      const tasks = await getColumnTasks(chain.columns[0].id);
      expect(tasks.map((t) => t.id)).not.toContain(task.id);
    });
  });

  it("answers 400 for an invalid column id", async () => {
    await actingAs(chain.owner, async () => {
      await expectStatus(createTask("not-a-uuid", { title: "Bad" }), 400);
    });
  });
});