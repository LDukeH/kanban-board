import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Board } from "@/types/board";
import { createBoard, deleteBoard, getBoard, getBoards, updateBoard } from "@/lib/api/board.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, ISO_DATE_RE, UUID_RE } from "./helpers/http";
import { actingAs, installSessionManager } from "./helpers/session";
import { uniqueName } from "./helpers/uniq";

describe("live board API", () => {
  let chain: ProvisionedChain;
  let board: Board;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();
    chain = await provisionChain("board");
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    await tearDownChain(chain);
  });

  it("creates a board under the workspace", async () => {
    const created = await actingAs(chain.owner, async () =>
      createBoard(chain.workspace.id, { name: uniqueName("Live board") }),
    );

    expect(created.id).toMatch(UUID_RE);
    expect(created.workspaceId).toBe(chain.workspace.id);
    expect(created.createdAt).toMatch(ISO_DATE_RE);
    expect(created.updatedAt).toMatch(ISO_DATE_RE);
    board = created;
  });

  it("lists the workspace boards including the created one", async () => {
    await actingAs(chain.owner, async () => {
      const boards = await getBoards(chain.workspace.id);
      expect(boards.map((b) => b.id)).toContain(board.id);
    });
  });

  it("reads a board by id", async () => {
    const fetched = await actingAs(chain.owner, () => getBoard(board.id));

    expect(fetched.id).toBe(board.id);
    expect(fetched.workspaceId).toBe(chain.workspace.id);
    expect(fetched.name).toBe(board.name);
  });

  it("updates a board", async () => {
    const updated = await actingAs(chain.owner, async () =>
      updateBoard(board.id, { name: uniqueName("Live board updated") }),
    );

    expect(updated.id).toBe(board.id);
    expect(updated.name).not.toBe(board.name);
  });

  it("deletes a board and answers 404 afterwards", async () => {
    await actingAs(chain.owner, async () => {
      const doomed = await createBoard(chain.workspace.id, { name: uniqueName("Live board doomed") });
      await deleteBoard(doomed.id);

      await expectStatus(getBoard(doomed.id), 404);
    });
  });

  it("answers 400 for an invalid workspace id when creating a board", async () => {
    await actingAs(chain.owner, async () => {
      await expectStatus(createBoard("not-a-uuid", { name: "Bad" }), 400);
    });
  });
});