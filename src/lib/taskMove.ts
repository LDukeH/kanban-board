/**
 * Pure helpers for task position moves (no React, no queries).
 * Moved verbatim from `useColumnTasks` so the OCC move queue and the
 * pending-move persistence can share one implementation.
 */

/** Scopes a per-column move gate to its board. */
export function columnGateKey(boardId: string, columnId: string): string {
  return `${boardId}:${columnId}`;
}

/** The move source defaults to the hook's column when the caller omits it. */
export function resolveMoveColumns(
  hookColumnId: string | undefined,
  paramSourceId: string | undefined,
): string | undefined {
  return paramSourceId ?? hookColumnId;
}

/** Gate keys for every column a move touches (deduplicated for same-column moves). */
export function touchedColumnGateKeys(
  boardId: string,
  sourceColumnId: string,
  targetColumnId: string,
): string[] {
  return [...new Set([sourceColumnId, targetColumnId])].map((column) =>
    columnGateKey(boardId, column),
  );
}
