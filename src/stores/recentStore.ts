import { create } from "zustand";

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
  setScope: (userId: string | null) => void;
  recordWorkspace: (workspace: RecentWorkspaceEntry) => void;
  recordBoard: (board: RecentBoardEntry) => void;
  renameWorkspace: (workspaceId: string, name: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  forgetWorkspace: (workspaceId: string) => void;
  forgetBoard: (boardId: string) => void;
}

/**
 * How many recently accessed workspaces we remember and render. For boards
 * the limit applies per workspace: the sidebar's boards section is scoped to
 * the workspace being viewed and shows at most this many of its boards.
 */
export const RECENT_LIMIT = 4;

const LEGACY_STORAGE_KEY = "kanban-recent";
const STORAGE_PREFIX = "kanban-recent:";

interface RecentData {
  recentWorkspaces: RecentWorkspaceEntry[];
  recentBoards: RecentBoardEntry[];
}

function loadScope(userId: string | null): RecentData {
  if (!userId) return { recentWorkspaces: [], recentBoards: [] };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return { recentWorkspaces: [], recentBoards: [] };
    const parsed = JSON.parse(raw) as Partial<RecentData>;
    return {
      recentWorkspaces: Array.isArray(parsed.recentWorkspaces)
        ? parsed.recentWorkspaces
        : [],
      recentBoards: Array.isArray(parsed.recentBoards)
        ? parsed.recentBoards
        : [],
    };
  } catch {
    return { recentWorkspaces: [], recentBoards: [] };
  }
}

function saveScope(userId: string | null, data: RecentData): void {
  if (!userId) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data));
  } catch {
    // Ignore (private mode / quota) — the in-memory recents still work.
  }
}

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

/**
 * Board variant of `pushRecent`. Boards are remembered per workspace — the
 * sidebar's boards section is scoped to the workspace being viewed — so the
 * `limit` caps each workspace's slice of the list instead of the list as a
 * whole. A new board is prepended and, if its workspace is over the limit,
 * the oldest entries of that workspace are evicted; other workspaces'
 * entries are untouched and keep their order.
 */
function pushRecentBoard(
  entries: RecentBoardEntry[],
  entry: RecentBoardEntry,
  limit: number,
): RecentBoardEntry[] {
  const existing = entries.find((item) => item.id === entry.id);
  if (existing) {
    // Already listed — keep its position, just refresh the stored fields.
    return entries.map((item) =>
      item.id === entry.id ? { ...item, ...entry } : item,
    );
  }
  const updated = [entry, ...entries];
  let seen = 0;
  return updated.filter((item) => {
    if (item.workspaceId !== entry.workspaceId) return true;
    seen += 1;
    return seen <= limit;
  });
}

export const useRecentStore = create<RecentState>((set, get) => {
  // The account whose recents are currently in memory (not persisted itself).
  let scopeUserId: string | null = null;

  return {
    recentWorkspaces: [],
    recentBoards: [],

    setScope: (userId) => {
      if (scopeUserId === userId) return;

      // Flush the previous account's recents before switching away.
      saveScope(scopeUserId, {
        recentWorkspaces: get().recentWorkspaces,
        recentBoards: get().recentBoards,
      });

      // One-time migration: drop the pre-scoping global key. Whoever owned it
      // is unknowable now, so keeping it would just re-leak stale recents.
      if (scopeUserId === null) {
        try {
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // Ignore (private mode / quota).
        }
      }

      const { recentWorkspaces, recentBoards } = loadScope(userId);
      scopeUserId = userId;
      set({ recentWorkspaces, recentBoards });
    },

    recordWorkspace: (workspace) => {
      const recentWorkspaces = pushRecent(
        get().recentWorkspaces,
        { id: workspace.id, name: workspace.name },
        RECENT_LIMIT,
      );
      set({ recentWorkspaces });
      saveScope(scopeUserId, {
        recentWorkspaces,
        recentBoards: get().recentBoards,
      });
    },

    recordBoard: (board) => {
      const recentBoards = pushRecentBoard(
        get().recentBoards,
        { id: board.id, name: board.name, workspaceId: board.workspaceId },
        RECENT_LIMIT,
      );
      set({ recentBoards });
      saveScope(scopeUserId, {
        recentWorkspaces: get().recentWorkspaces,
        recentBoards,
      });
    },

    // Renames update listed entries in place (same position, new name).
    // They never insert: renaming something the user never opened must not
    // make it "recent".
    renameWorkspace: (workspaceId, name) => {
      const recentWorkspaces = get().recentWorkspaces.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, name } : workspace,
      );
      set({ recentWorkspaces });
      saveScope(scopeUserId, {
        recentWorkspaces,
        recentBoards: get().recentBoards,
      });
    },

    renameBoard: (boardId, name) => {
      const recentBoards = get().recentBoards.map((board) =>
        board.id === boardId ? { ...board, name } : board,
      );
      set({ recentBoards });
      saveScope(scopeUserId, {
        recentWorkspaces: get().recentWorkspaces,
        recentBoards,
      });
    },

    forgetWorkspace: (workspaceId) => {
      const recentWorkspaces = get().recentWorkspaces.filter(
        (workspace) => workspace.id !== workspaceId,
      );
      const recentBoards = get().recentBoards.filter(
        (board) => board.workspaceId !== workspaceId,
      );
      set({ recentWorkspaces, recentBoards });
      saveScope(scopeUserId, { recentWorkspaces, recentBoards });
    },

    forgetBoard: (boardId) => {
      const recentBoards = get().recentBoards.filter(
        (board) => board.id !== boardId,
      );
      set({ recentBoards });
      saveScope(scopeUserId, {
        recentWorkspaces: get().recentWorkspaces,
        recentBoards,
      });
    },
  };
});
