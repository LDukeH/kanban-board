import { expect } from "vitest";

/**
 * Asserts an axios call rejects with a specific HTTP status. The live backend
 * signals failures by status code (plain-text error bodies, per §24.1 of the
 * source-of-truth doc), so this is the live suite's primary failure assertion.
 */
export async function expectStatus<T>(promise: Promise<T>, status: number): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const actual = (error as { response?: { status?: number } }).response?.status;
    expect(actual).toBe(status);
    return;
  }
  expect.unreachable(`Expected the request to reject with ${status}, but it resolved`);
}

/** Backend identifiers are UUIDs per the source-of-truth contract (§19.2). */
export const UUID_RE = /^[0-9a-fA-F-]{32,40}$/;

/** Backend timestamps are ISO-8601. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;