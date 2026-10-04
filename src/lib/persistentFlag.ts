/** Tiny boolean-flag persistence for presentation state; every access is wrapped so private mode / quota failures degrade to the in-memory default. */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readFlag(key: string, fallback = false): boolean {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

export function writeFlag(key: string, value: boolean): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, value ? "true" : "false");
  } catch {
    // Ignore (private mode / quota) — the in-memory state still works.
  }
}