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
  reconcileWorkspaces: (workspaces: RecentWorkspaceEntry[]) => void;
  forgetWorkspace: (workspaceId: string) => void;
  forgetBoard: (boardId: string) => void;
}

/** Limit for recently accessed workspaces; for boards it applies per workspace, since the sidebar's boards section is workspace-scoped. */
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

/** Insert at the front if new, de-duplicate by id, cap at `limit`; existing entries keep their position so the sidebar stays stable. */
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

/** Board variant of `pushRecent`: the `limit` caps each workspace's slice, evicting that workspace's oldest entries and leaving others untouched. */
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

  // Renames update listed entries in place and never insert: renaming something never opened must not make it "recent".
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

    reconcileWorkspaces: (workspaces) => {
      const validById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
      const recentWorkspaces = get().recentWorkspaces
        .filter((workspace) => validById.has(workspace.id))
        .map((workspace) => ({
          ...workspace,
          name: validById.get(workspace.id)!.name,
        }));
      const validWorkspaceIds = new Set(validById.keys());
      const recentBoards = get().recentBoards.filter((board) =>
        validWorkspaceIds.has(board.workspaceId),
      );
      set({ recentWorkspaces, recentBoards });
      saveScope(scopeUserId, { recentWorkspaces, recentBoards });
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
