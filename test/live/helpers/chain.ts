import { createBoard } from "@/lib/api/board.api";
import { createColumn } from "@/lib/api/column.api";
import { createWorkspace, deleteWorkspace } from "@/lib/api/workspace.api";
import type { Board, Column } from "@/types/board";
import type { Workspace } from "@/types/workspace";
import { deleteAccount, loginAs, provisionUser, type LiveAccount } from "./session";
import { uniqueName } from "./uniq";

export interface ProvisionedChain {
  owner: LiveAccount;
  workspace: Workspace;
  board: Board;
  columns: Column[];
}

/**
 * Standard live fixture: a fresh throwaway owner account plus a workspace ->
 * board -> "To Do" column owned by it. The shared client ends logged in as the
 * owner, ready for subsequent member/task/label/comment setup.
 *
 * Tear down with `tearDownChain` — deleting the workspace cascades boards,
 * columns, tasks, labels and comments (§18.1 of the source-of-truth doc).
 */
export async function provisionChain(prefix: string): Promise<ProvisionedChain> {
  const owner = await provisionUser(`${prefix}-owner`);
  await loginAs(owner);
  const workspace = await createWorkspace({ name: uniqueName(`${prefix} workspace`) });
  const board = await createBoard(workspace.id, { name: uniqueName(`${prefix} board`) });
  const column = await createColumn(board.id, { name: "To Do" });
  return { owner, workspace, board, columns: [column] };
}

/**
 * Tears down a provisioned chain and the throwaway owner account itself.
 *
 * Order matters: the workspace goes first, then the account. Ownership lives in
 * `workspace_memberships` and the backend has no ownership-transfer trigger
 * (migration 012 is unimplemented), so deleting an owner before its workspace
 * would strand the workspace ownerless. Deleting the user then cascades the
 * owner's memberships, task_assignees, notifications, comments and invitations,
 * so the run leaves no residue behind.
 */
export async function tearDownChain(
  chain: Pick<ProvisionedChain, "owner" | "workspace">,
): Promise<void> {
  await loginAs(chain.owner);
  await deleteWorkspace(chain.workspace.id);
  await deleteAccount(chain.owner);
}