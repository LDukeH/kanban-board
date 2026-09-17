/**
 * In-memory localStorage/sessionStorage shim so the Node test environment can
 * exercise URL/local persistence (task filters, recent store, zustand persist)
 * without a browser. Installed once by test/setup.ts before any store module is
 * imported, because zustand's persist middleware resolves `localStorage` at
 * module-import time.
 */

export type StorageKind = "local" | "session";

type StorageMethod = "getItem" | "setItem" | "removeItem" | "clear" | "key";

class MemoryStorage {
  private readonly store = new Map<string, string>();
  private readonly throwingMethods = new Set<StorageMethod>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.throwIf("clear");
    this.store.clear();
  }

  getItem(key: string): string | null {
    this.throwIf("getItem");
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    this.throwIf("key");
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.throwIf("removeItem");
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.throwIf("setItem");
    this.store.set(key, value);
  }

  /** Make the next access of `method` throw, to exercise exception-swallowing paths. */
  installFailure(method: StorageMethod): void {
    this.throwingMethods.add(method);
  }

  clearFailures(): void {
    this.throwingMethods.clear();
  }

  private throwIf(method: StorageMethod): void {
    if (this.throwingMethods.has(method)) {
      throw new Error(`Simulated ${method} failure`);
    }
  }
}

const storages: Record<StorageKind, MemoryStorage> = {
  local: new MemoryStorage(),
  session: new MemoryStorage(),
};

export function installStorageShim(): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: storages.local,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storages.session,
    configurable: true,
    writable: true,
  });
  // zustand's persist middleware resolves the DOM storage via `window` (not the
  // bare identifier), so wire the worker global through a window object too.
  // Test-env only: no production module switches behavior on `window` today.
  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      configurable: true,
      writable: true,
    });
  }
}

export function clearStorageShim(kind: StorageKind | "all" = "all"): void {
  if (kind === "all") {
    storages.local.clear();
    storages.session.clear();
    storages.local.clearFailures();
    storages.session.clearFailures();
    return;
  }
  storages[kind].clear();
  storages[kind].clearFailures();
}

/** Force storage access to throw (exercises the swallow-exceptions contracts). */
export function failStorageAccess(kind: StorageKind, method: StorageMethod): void {
  storages[kind].installFailure(method);
}

/** Direct read of one storage key, for asserting what persisted. */
export function readRawStorage(kind: StorageKind, key: string): string | null {
  return storages[kind].getItem(key);
}