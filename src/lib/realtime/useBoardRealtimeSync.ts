import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createBoardEventCoalescer, useBoardRealtime } from "./useBoardRealtime";
import type { BoardEventEnvelope } from "./boardEvents";

// Wires the board broadcast channel into React Query with burst coalescing.
export function useBoardRealtimeSync(
  boardId: string | undefined,
  options: { onError?: (error: Error) => void } = {},
): void {
  const queryClient = useQueryClient();
  const { onError } = options;

  const coalescer = useMemo(
    () =>
      boardId ? createBoardEventCoalescer(queryClient, boardId) : null,
    [queryClient, boardId],
  );

  // Cancel the pending debounce when the board changes or unmounts.
  useEffect(() => () => coalescer?.dispose(), [coalescer]);

  const handlers = useMemo(
    () => ({
      onEvent: (event: BoardEventEnvelope) => coalescer?.push(event),
      onError: onError ?? ((error: Error) => console.error("Board realtime error:", error)),
    }),
    [coalescer, onError],
  );

  useBoardRealtime(boardId, handlers);
}
