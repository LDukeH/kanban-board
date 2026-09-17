/**
 * Unique-name factories for live-API runs. Every run must avoid colliding with
 * data from previous runs (workspaces, users, emails) since the dev backend
 * persists between test executions.
 */
let counter = 0;

function randomSegment(): string {
  counter += 1;
  return `${Date.now().toString(36)}${(counter * 7919).toString(36)}x${Math.random().toString(36).slice(2, 6)}`;
}

export function uniqueEmail(prefix: string): string {
  return `live.${prefix}.${randomSegment()}@example.com`;
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${randomSegment()}`;
}

/** Password satisfying the shared auth schema (>= 8 chars). */
export function uniquePassword(): string {
  return `Pass${randomSegment()}!`;
}