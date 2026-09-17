import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Column } from "@/types/board";
import {
  createColumn,
  deleteColumn,
  getBoardColumns,
  updateColumn,
  updateColumnPosition,
} from "@/lib/api/column.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import { actingAs, installSessionManager } from "./helpers/session";

describe("live column API", () => {
  let chain: ProvisionedChain;
  let doneColumn: Column;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();
    chain = await provisionChain("column");
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    await tearDownChain(chain);
  });

  it("creates columns with sequential positions", async () => {
    await actingAs(chain.owner, async () => {
      const second = await createColumn(chain.board.id, { name: "Done" });

      expect(chain.columns[0].id).toMatch(UUID_RE);
      expect(chain.columns[0].boardId).toBe(chain.board.id);
      expect(chain.columns[0].position).toBe(0);
      expect(second.position).toBe(1);
      doneColumn = second;
    });
  });

  it("lists a board's columns", async () => {
    await actingAs(chain.owner, async () => {
      const columns = await getBoardColumns(chain.board.id);
      expect(columns.map((c) => c.id)).toEqual(
        expect.arrayContaining([chain.columns[0].id, doneColumn.id]),
      );
    });
  });

  it("renames a column", async () => {
    const updated = await actingAs(chain.owner, async () =>
      updateColumn(doneColumn.id, { name: "Done v2" }),
    );

    expect(updated.id).toBe(doneColumn.id);
    expect(updated.name).toBe("Done v2");
  });

  it("repositions a column", async () => {
    await actingAs(chain.owner, async () => {
      const moved = await updateColumnPosition(doneColumn.id, 0);
      expect(moved.position).toBe(0);

      const columns = await getBoardColumns(chain.board.id);
      expect(columns[0].id).toBe(doneColumn.id);
      expect(columns[1].id).toBe(chain.columns[0].id);
    });
  });

  it("deletes a column", async () => {
    await actingAs(chain.owner, async () => {
      await deleteColumn(doneColumn.id);

      const columns = await getBoardColumns(chain.board.id);
      expect(columns.map((c) => c.id)).not.toContain(doneColumn.id);
    });
  });

  it("answers 400 for an invalid board id when creating a column", async () => {
    await actingAs(chain.owner, async () => {
      await expectStatus(createColumn("not-a-uuid", { name: "Bad" }), 400);
    });
  });
});