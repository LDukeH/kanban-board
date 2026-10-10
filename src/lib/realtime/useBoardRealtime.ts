import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  isBoardEventEnvelope,
  type BoardEventEnvelope,
} from "./boardEvents";

export interface BoardRealtimeEventHandlers {
  onEvent: (event: BoardEventEnvelope) => void;
  onError: (error: Error) => void;
}

// Reorder bursts touch the board twice (old + new position); coalesce them.
export const BOARD_REALTIME_DEBOUNCE_MS = 300;

function isBoardQuery(boardId: string, queryKey: readonly unknown[]) {
  return queryKey[0] === "boards" && queryKey[1] === boardId;
}

// Task lists live under [boards, boardId, columns, columnId, tasks].
function isBoardTasksQuery(boardId: string, queryKey: readonly unknown[]) {
  return (
    queryKey.length === 5 &&
    isBoardQuery(boardId, queryKey) &&
    queryKey[2] === "columns" &&
    queryKey[4] === "tasks"
  );
}

type QueryInvalidator = Pick<QueryClient, "invalidateQueries">;

// Matches the predicate style already used in useBoard/useColumnTasks.
export function boardEventInvalidation(
  boardId: string,
  event: BoardEventEnvelope,
): Parameters<QueryInvalidator["invalidateQueries"]>[0] {
  // column_deleted cascades its tasks server-side, so both caches go stale.
  const columnsOnly =
    event.type.startsWith("column_") && event.type !== "column_deleted";
  return {
    predicate: (query) => {
      if (!isBoardQuery(boardId, query.queryKey)) return false;
      if (query.queryKey.length === 3 && query.queryKey[2] === "columns") {
        return true;
      }
      return !columnsOnly && isBoardTasksQuery(boardId, query.queryKey);
    },
  };
}

// Invalidates one board's columns/tasks without touching other boards.
export function invalidateBoardEventQueries(
  queryClient: QueryInvalidator,
  boardId: string,
  event: BoardEventEnvelope,
): void {
  void queryClient.invalidateQueries(boardEventInvalidation(boardId, event));
}

// Coalesces rapid event bursts into one invalidation pass per board.
export function createBoardEventCoalescer(
  queryClient: QueryInvalidator,
  boardId: string,
  delayMs = BOARD_REALTIME_DEBOUNCE_MS,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let needsColumns = false;
  let needsTasks = false;
  let disposed = false;

  function flush() {
    timer = null;
    const invalidateColumns = needsColumns;
    const invalidateTasks = needsTasks;
    needsColumns = false;
    needsTasks = false;
    // One predicate pass covers columns and every column task list.
    if (invalidateColumns || invalidateTasks) {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          if (!isBoardQuery(boardId, query.queryKey)) return false;
          if (
            invalidateColumns &&
            query.queryKey.length === 3 &&
            query.queryKey[2] === "columns"
          ) {
            return true;
          }
          return invalidateTasks && isBoardTasksQuery(boardId, query.queryKey);
        },
      });
    }
  }

  return {
    push(event: BoardEventEnvelope) {
      if (disposed || event.board_id !== boardId) return;
      if (event.type.startsWith("column_")) needsColumns = true;
      if (event.type.startsWith("task_") || event.type === "column_deleted") {
        needsTasks = true;
      }
      // Task changes also refresh column order/counts shown in the header.
      if (event.type.startsWith("task_")) needsColumns = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      needsColumns = false;
      needsTasks = false;
    },
  };
}

export type BoardEventCoalescer = ReturnType<
  typeof createBoardEventCoalescer
>;

// Subscribes to the private board broadcast channel using the current Supabase session.
export function useBoardRealtime(
  boardId: string | undefined,
  handlers: BoardRealtimeEventHandlers,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!boardId) {
      return;
    }

    let channelClosed = false;
    const channel = supabase
      .channel(`board:${boardId}`, { config: { private: true } })
      .on("broadcast", { event: "*" }, (message) => {
        // Broadcast callback wraps the trigger payload in `payload`.
        const record =
          message && typeof message === "object"
            ? (message as Record<string, unknown>)
            : null;
        const raw =
          record && "payload" in record ? record["payload"] : message;
        if (!isBoardEventEnvelope(raw)) {
          handlersRef.current.onError(new Error("Invalid realtime event payload"));
          return;
        }
        if (raw.board_id !== boardId) {
          return;
        }
        handlersRef.current.onEvent(raw);
      })
      .subscribe((status, error) => {
        // Only surface real failures; SUBSCRIBED needs no action.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Supabase retries failed joins automatically. A private-channel
          // authorization/configuration failure cannot recover from the
          // browser, so remove it to avoid an endless error loop.
          if (!channelClosed) {
            channelClosed = true;
            void supabase.removeChannel(channel);
          }
          handlersRef.current.onError(
            error instanceof Error
              ? error
              : new Error(`Realtime subscribe failed: ${status}`),
          );
        }
      });

    // One channel per board; remove it when the board changes or unmounts.
    return () => {
      channelClosed = true;
      void supabase.removeChannel(channel);
    };
  }, [boardId]);
}
