import { beforeEach, describe, expect, it } from "vitest";
import { RECENT_LIMIT, useRecentStore } from "@/stores/recentStore";
import { clearStorageShim, readRawStorage } from "../helpers/storageShim";

const scopeUser = "user-1";

beforeEach(() => {
  clearStorageShim();
  useRecentStore.setState({ recentWorkspaces: [], recentBoards: [] });
  useRecentStore.getState().setScope(null);
});

function recordWorkspace(id: string, name = id) {
  useRecentStore.getState().recordWorkspace({ id, name });
}

function recordBoard(id: string, workspaceId: string, name = id) {
  useRecentStore.getState().recordBoard({ id, name, workspaceId });
}

describe("recordWorkspace", () => {
  it("prepends new workspaces and caps the list at RECENT_LIMIT", () => {
    useRecentStore.getState().setScope(scopeUser);
    for (let i = 1; i <= RECENT_LIMIT + 2; i += 1) {
      recordWorkspace(`ws-${i}`, `W${i}`);
    }
    const { recentWorkspaces } = useRecentStore.getState();
    expect(recentWorkspaces).toHaveLength(RECENT_LIMIT);
    expect(recentWorkspaces[0].id).toBe(`ws-${RECENT_LIMIT + 2}`);
    expect(recentWorkspaces[recentWorkspaces.length - 1].id).toBe("ws-3");
  });

  it("keeps an existing workspace's position and refreshes its stored fields", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordWorkspace("ws-1", "Before");
    recordWorkspace("ws-2");
    // New entries prepend onto the front, so ws-1 now sits at index 1.
    expect(useRecentStore.getState().recentWorkspaces.map((w) => w.id)).toEqual(["ws-2", "ws-1"]);

    recordWorkspace("ws-1", "After");
    const { recentWorkspaces } = useRecentStore.getState();
    expect(recentWorkspaces.map((w) => w.id)).toEqual(["ws-2", "ws-1"]);
    expect(recentWorkspaces[1].name).toBe("After");
  });

  it("keeps the in-memory list even when no account scope is set", () => {
    recordWorkspace("ws-1");
    const { recentWorkspaces } = useRecentStore.getState();
    expect(recentWorkspaces.map((w) => w.id)).toEqual(["ws-1"]);
    // The record is not persisted without an account scope.
    const stored = readRawStorage("local", `kanban-recent:${scopeUser}`);
    const parsed = stored
      ? (JSON.parse(stored) as { recentWorkspaces: { id: string }[] })
      : { recentWorkspaces: [] };
    expect(parsed.recentWorkspaces.map((w) => w.id)).not.toContain("ws-1");
  });
});

describe("recordBoard", () => {
  it("caps boards per workspace without evicting other workspaces' boards", () => {
    useRecentStore.getState().setScope(scopeUser);
    for (let i = 1; i <= RECENT_LIMIT; i += 1) {
      recordBoard(`a-${i}`, "ws-a");
    }
    recordBoard("b-1", "ws-b");
    recordBoard("a-5", "ws-a");

    const { recentBoards } = useRecentStore.getState();
    const wsCount = recentBoards.filter((b) => b.workspaceId === "ws-a").length;
    const wsBCount = recentBoards.filter((b) => b.workspaceId === "ws-b").length;
    expect(wsCount).toBe(RECENT_LIMIT);
    expect(wsBCount).toBe(1);
    expect(recentBoards[0].id).toBe("a-5");
    // The oldest ws-a board (a-1) was evicted; newer ws-a boards stay.
    expect(recentBoards.some((b) => b.id === "a-1")).toBe(false);
    expect(recentBoards.some((b) => b.id === "a-4")).toBe(true);
  });

  it("keeps an existing board's position and refreshes its name", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordBoard("a-1", "ws-a", "Before");
    recordBoard("a-2", "ws-a");
    expect(useRecentStore.getState().recentBoards.map((b) => b.id)).toEqual(["a-2", "a-1"]);

    recordBoard("a-1", "ws-a", "After");
    const { recentBoards } = useRecentStore.getState();
    expect(recentBoards.map((b) => b.id)).toEqual(["a-2", "a-1"]);
    expect(recentBoards[1].name).toBe("After");
  });
});
describe("rename", () => {
  it("updates listed workspaces in place and never inserts", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordWorkspace("ws-1", "Before");
    useRecentStore.getState().renameWorkspace("ghost", "Never");
    useRecentStore.getState().renameWorkspace("ws-1", "After");

    expect(useRecentStore.getState().recentWorkspaces).toEqual([{ id: "ws-1", name: "After" }]);
  });

  it("updates listed boards in place and never inserts", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordBoard("a-1", "ws-a", "Before");
    useRecentStore.getState().renameBoard("ghost", "Never");
    useRecentStore.getState().renameBoard("a-1", "After");

    expect(useRecentStore.getState().recentBoards).toEqual([
      { id: "a-1", name: "After", workspaceId: "ws-a" },
    ]);
  });
});

describe("forget", () => {
  it("forgetWorkspace removes the workspace and all of its boards", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordWorkspace("ws-a", "A");
    recordWorkspace("ws-b", "B");
    recordBoard("a-1", "ws-a");
    recordBoard("a-2", "ws-a");
    recordBoard("b-1", "ws-b");

    useRecentStore.getState().forgetWorkspace("ws-a");

    expect(useRecentStore.getState().recentWorkspaces.map((w) => w.id)).toEqual(["ws-b"]);
    expect(useRecentStore.getState().recentBoards.map((b) => b.id)).toEqual(["b-1"]);
  });

  it("forgetBoard removes only the requested board", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordBoard("a-1", "ws-a");
    recordBoard("a-2", "ws-a");
    useRecentStore.getState().forgetBoard("a-1");

    expect(useRecentStore.getState().recentBoards.map((b) => b.id)).toEqual(["a-2"]);
  });
});

describe("persistence and account scoping", () => {
  it("persists recents under the account key", () => {
    useRecentStore.getState().setScope(scopeUser);
    recordWorkspace("ws-1", "W1");
    recordBoard("a-1", "ws-a", "A1");

    const stored = readRawStorage("local", `kanban-recent:${scopeUser}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as {
      recentWorkspaces: { id: string }[];
      recentBoards: { id: string }[];
    };
    expect(parsed.recentWorkspaces[0].id).toBe("ws-1");
    expect(parsed.recentBoards[0].id).toBe("a-1");
  });

  it("isolates recents per account and restores them on scope switch", () => {
    useRecentStore.getState().setScope("user-1");
    recordWorkspace("mine-1");
    useRecentStore.getState().setScope("user-2");
    expect(useRecentStore.getState().recentWorkspaces).toEqual([]);
    recordWorkspace("theirs-1");

    useRecentStore.getState().setScope("user-1");
    expect(useRecentStore.getState().recentWorkspaces.map((w) => w.id)).toEqual(["mine-1"]);
  });

  it("removes the legacy pre-scoping storage key when binding a scope for the first time", () => {
    globalThis.localStorage.setItem("kanban-recent", JSON.stringify([{ id: "stale" }]));
    useRecentStore.getState().setScope(scopeUser);
    expect(readRawStorage("local", "kanban-recent")).toBeNull();
  });
});