/**
 * Cross-reload conflict notices for stale moves.
 *
 * A replayed position PATCH (hydrated from `kanban-pending-task-moves` on load) can be
 * rejected with 409/404 inside a hook effect that has no way to reach the page's move-notice
 * banner. The hook parks the message here; `BoardPage` drains it for its boardId on mount.
 */
export type StaleMoveNotice = {
  boardId: string;
  message: string;
};

const STORAGE_KEY = "kanban-stale-move-notices";

/** Fired on `window` after a notice is stored so a mounted BoardPage can drain it without waiting for a reload. */
export const STALE_MOVE_NOTICE_EVENT = "kanban:stale-move-notice";

export function readStaleMoveNotices(): StaleMoveNotice[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const notices = JSON.parse(stored) as unknown;
    return Array.isArray(notices) ? (notices as StaleMoveNotice[]) : [];
  } catch {
    return [];
  }
}

/** Keeps at most one notice per board (the latest wins) so repeated conflicts do not spam the banner. */
export function writeStaleMoveNotice(boardId: string, message: string): void {
  try {
    const others = readStaleMoveNotices().filter(
      (notice) => notice.boardId !== boardId,
    );
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...others, { boardId, message }]),
    );
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    window.dispatchEvent(
      new CustomEvent(STALE_MOVE_NOTICE_EVENT, { detail: { boardId } }),
    );
  }
}

/** Removes and returns the notices for `boardId`; other boards' notices stay queued until they mount. */
export function drainStaleMoveNotices(boardId: string): StaleMoveNotice[] {
  try {
    const notices = readStaleMoveNotices();
    const mine = notices.filter((notice) => notice.boardId === boardId);
    const others = notices.filter((notice) => notice.boardId !== boardId);
    if (others.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(others));
    }
    return mine;
  } catch {
    return [];
  }
}