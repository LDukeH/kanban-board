import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STALE_MOVE_NOTICE_EVENT,
  drainStaleMoveNotices,
  readStaleMoveNotices,
  writeStaleMoveNotice,
} from "@/lib/staleMoveNotices";

const STORAGE_KEY = "kanban-stale-move-notices";

describe("staleMoveNotices", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // The dispatch path is browser-only; give the node test environment a real EventTarget as `window`.
    Object.defineProperty(globalThis, "window", {
      value: new EventTarget(),
      configurable: true,
      writable: true,
    });
  });

  it("keeps one notice per board (latest wins) and drains them by boardId", () => {
    writeStaleMoveNotice("b1", "first conflict");
    writeStaleMoveNotice("b2", "other board");
    writeStaleMoveNotice("b1", "latest wins");

    expect(drainStaleMoveNotices("b1")).toEqual([
      { boardId: "b1", message: "latest wins" },
    ]);
    // Drained: nothing left for b1 while b2 stays queued for its own board.
    expect(drainStaleMoveNotices("b1")).toEqual([]);
    expect(readStaleMoveNotices()).toEqual([
      { boardId: "b2", message: "other board" },
    ]);

    expect(drainStaleMoveNotices("b2")).toEqual([
      { boardId: "b2", message: "other board" },
    ]);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("tolerates a malformed stored payload", () => {
    sessionStorage.setItem(STORAGE_KEY, "not json");
    expect(readStaleMoveNotices()).toEqual([]);
  });

  it("dispatches the notice event so a mounted board drains immediately", () => {
    const listener = vi.fn();
    window.addEventListener(STALE_MOVE_NOTICE_EVENT, listener);

    writeStaleMoveNotice("b1", "conflict");

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(STALE_MOVE_NOTICE_EVENT, listener);
  });
});