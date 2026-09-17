import { afterEach } from "vitest";
import { clearStorageShim, installStorageShim } from "./helpers/storageShim";

// Storage must exist before `@/stores/workspaceStore` is imported (zustand
// persist resolves `localStorage` at module load), so install it from a setup
// file — Vitest runs setupFiles before the test module graph is imported.
installStorageShim();

afterEach(() => {
  clearStorageShim();
});