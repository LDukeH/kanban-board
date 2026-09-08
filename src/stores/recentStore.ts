import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentWorkspaceEntry {
  id: string;
  name: string;
}

export interface RecentBoardEntry {
  id: string;
  name: string;
  workspaceId: string;
}

interface RecentState {
  recentWorkspaces: RecentWorkspaceEntry[];
  recentBoards: RecentBoardEntry[];
  recordWorkspace: (workspace: RecentWorkspaceEntry) => void;
  recordBoard: (board: RecentBoardEntry) => void;
  forgetWorkspace: (workspaceId: string) => void;
  forgetBoard: (boardId: string) => void;
}

/**
 * How many recently accessed workspaces/boards we remember and render.
 * The sidebar shows at most this many of each type.
 */
export const RECENT_LIMIT = 4;

/**
 * Insert at the front if new, de-duplicate by id, and cap the list at `limit`.
 * Existing entries keep their position (no reordering) so the sidebar list
 * stays stable during a session; only brand-new entries push older ones out.
 */
function pushRecent<T extends { id: string }>(
  entries: T[],
  entry: T,
  limit: number,
): T[] {
  const existing = entries.find((item) => item.id === entry.id);
  if (existing) {
    // Already listed — keep its position, just refresh the stored fields.
    return entries.map((item) =>
      item.id === entry.id ? { ...item, ...entry } : item,
    );
  }
  return [entry, ...entries].slice(0, limit);
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      recentWorkspaces: [],
      recentBoards: [],

      /** Remember a workspace as just accessed (keeps the latest 4). */
      recordWorkspace: (workspace) =>
        set({
          recentWorkspaces: pushRecent(
            get().recentWorkspaces,
            { id: workspace.id, name: workspace.name },
            RECENT_LIMIT,
          ),
        }),

      /** Remember a board as just accessed (keeps the latest 4). */
      recordBoard: (board) =>
        set({
          recentBoards: pushRecent(
            get().recentBoards,
            { id: board.id, name: board.name, workspaceId: board.workspaceId },
            RECENT_LIMIT,
          ),
        }),

      /** Drop a workspace and any of its boards from the recents. */
      forgetWorkspace: (workspaceId) =>
        set({
          recentWorkspaces: get().recentWorkspaces.filter(
            (workspace) => workspace.id !== workspaceId,
          ),
          recentBoards: get().recentBoards.filter(
            (board) => board.workspaceId !== workspaceId,
          ),
        }),

      /** Drop a single board from the recents. */
      forgetBoard: (boardId) =>
        set({
          recentBoards: get().recentBoards.filter(
            (board) => board.id !== boardId,
          ),
        }),
    }),
    {
      name: "kanban-recent",
    },
  ),
);