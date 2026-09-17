import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "@/lib/relativeTime";

const NOW = new Date("2026-01-01T12:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
});

function freezeTime(atIso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(atIso));
}

describe("formatRelativeTime", () => {
  it('returns "just now" for anything under a minute in the past', () => {
    freezeTime(NOW.toISOString());
    expect(formatRelativeTime("2026-01-01T11:59:01.000Z")).toBe("just now"); // 59s
    expect(formatRelativeTime("2026-01-01T11:59:31.000Z")).toBe("just now"); // 29s
  });

  it("clamps future timestamps to just now", () => {
    freezeTime(NOW.toISOString());
    expect(formatRelativeTime("2026-01-01T13:00:00.000Z")).toBe("just now");
    expect(formatRelativeTime("2026-01-03T00:00:00.000Z")).toBe("just now");
  });

  it('formats minutes ("Nm ago") from 1m up to 59m', () => {
    freezeTime(NOW.toISOString());
    expect(formatRelativeTime("2026-01-01T11:59:00.000Z")).toBe("1m ago");
    expect(formatRelativeTime("2026-01-01T11:01:00.000Z")).toBe("59m ago");
  });

  it('formats hours ("Nh ago") from 1h up to 23h', () => {
    freezeTime(NOW.toISOString());
    expect(formatRelativeTime("2026-01-01T11:00:00.000Z")).toBe("1h ago");
    expect(formatRelativeTime("2026-01-01T01:00:00.000Z")).toBe("11h ago");
    expect(formatRelativeTime("2025-12-31T13:00:00.000Z")).toBe("23h ago");
  });

  it('formats days ("Nd ago") up to 6d', () => {
    freezeTime(NOW.toISOString());
    expect(formatRelativeTime("2025-12-31T12:00:00.000Z")).toBe("1d ago");
    expect(formatRelativeTime("2025-12-26T12:00:00.000Z")).toBe("6d ago");
  });

  it('formats weeks ("Nw ago") from 7d onward', () => {
    freezeTime(NOW.toISOString());
    expect(formatRelativeTime("2025-12-25T12:00:00.000Z")).toBe("1w ago");
    expect(formatRelativeTime("2025-12-18T12:00:00.000Z")).toBe("2w ago");
    expect(formatRelativeTime("2025-01-01T12:00:00.000Z")).toBe("52w ago");
  });
});