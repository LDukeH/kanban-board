import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { clearStorageShim, readRawStorage } from "../helpers/storageShim";

const STORAGE_KEY = "kanban-workspace";

beforeEach(() => {
  clearStorageShim();
  useWorkspaceStore.setState({ selectedWorkspaceId: null });
});

describe("useWorkspaceStore", () => {
  it("starts with no selected workspace", () => {
    expect(useWorkspaceStore.getState().selectedWorkspaceId).toBeNull();
  });

  it("updates the selected workspace and persists it to storage", () => {
    useWorkspaceStore.getState().setSelectedWorkspaceId("ws-1");
    expect(useWorkspaceStore.getState().selectedWorkspaceId).toBe("ws-1");

    const stored = readRawStorage("local", STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as { state: { selectedWorkspaceId: string | null } };
    expect(parsed.state.selectedWorkspaceId).toBe("ws-1");
  });

  it("rehydrates the selected workspace from storage on a fresh load", async () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { selectedWorkspaceId: "ws-9" }, version: 0 }),
    );
    vi.resetModules();
    const fresh = await import("@/stores/workspaceStore");
    await vi.waitFor(() => {
      expect(fresh.useWorkspaceStore.getState().selectedWorkspaceId).toBe("ws-9");
    });
  });

  it("falls back to null on a fresh load when storage holds no value", async () => {
    vi.resetModules();
    const fresh = await import("@/stores/workspaceStore");
    await vi.waitFor(() => {
      expect(fresh.useWorkspaceStore.getState().selectedWorkspaceId).toBeNull();
    });
  });

  it("can clear the selection back to null", () => {
    useWorkspaceStore.getState().setSelectedWorkspaceId("ws-1");
    useWorkspaceStore.getState().setSelectedWorkspaceId(null);
    expect(useWorkspaceStore.getState().selectedWorkspaceId).toBeNull();
  });
});