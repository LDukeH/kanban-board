import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Label } from "@/types/board";
import {
  addLabelToTask,
  createLabel,
  deleteLabel,
  getBoardLabels,
  getLabel,
  removeLabelFromTask,
  updateLabel,
} from "@/lib/api/label.api";
import { createTask, getColumnTasks } from "@/lib/api/task.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import { actingAs, installSessionManager } from "./helpers/session";

describe("live label API", () => {
  let chain: ProvisionedChain;
  let bugLabel: Label;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();
    chain = await provisionChain("label");
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    await tearDownChain(chain);
  });

  it("creates a board label", async () => {
    const created = await actingAs(chain.owner, async () =>
      createLabel(chain.board.id, { name: "Bug", color: "#e11941" }),
    );

    expect(created.id).toMatch(UUID_RE);
    expect(created.boardId).toBe(chain.board.id);
    expect(created.name).toBe("Bug");
    expect(created.color).toBe("#e11941");
    bugLabel = created;
  });

  it("lists the board labels", async () => {
    await actingAs(chain.owner, async () => {
      const labels = await getBoardLabels(chain.board.id);
      expect(labels.map((l) => l.id)).toContain(bugLabel.id);
    });
  });

  it("reads a label by id", async () => {
    const fetched = await actingAs(chain.owner, () => getLabel(bugLabel.id));

    expect(fetched.id).toBe(bugLabel.id);
    expect(fetched.boardId).toBe(chain.board.id);
    expect(fetched.color).toBe("#e11941");
  });

  it("updates a label", async () => {
    await actingAs(chain.owner, () => updateLabel(bugLabel.id, { name: "Defect", color: "#a819e1" }));

    await actingAs(chain.owner, async () => {
      const updated = await getLabel(bugLabel.id);
      expect(updated.name).toBe("Defect");
      expect(updated.color).toBe("#a819e1");
    });
  });

  it("attaches and detaches a label on a task", async () => {
    await actingAs(chain.owner, async () => {
      const task = await createTask(chain.columns[0].id, { title: "Labeled task" });

      await addLabelToTask(task.id, bugLabel.id);
      const afterAdd = (await getColumnTasks(chain.columns[0].id)).find((t) => t.id === task.id);
      expect(afterAdd?.labels?.map((l) => l.id)).toContain(bugLabel.id);

      await removeLabelFromTask(task.id, bugLabel.id);
      const afterRemove = (await getColumnTasks(chain.columns[0].id)).find((t) => t.id === task.id);
      expect(afterRemove?.labels?.map((l) => l.id)).not.toContain(bugLabel.id);
    });
  });

  it("deletes a label", async () => {
    await actingAs(chain.owner, async () => {
      await deleteLabel(bugLabel.id);

      const labels = await getBoardLabels(chain.board.id);
      expect(labels.map((l) => l.id)).not.toContain(bugLabel.id);
    });
  });

  it("answers 400 for an invalid board id", async () => {
    await actingAs(chain.owner, async () => {
      await expectStatus(createLabel("not-a-uuid", { name: "Bad", color: "#000000" }), 400);
    });
  });
});