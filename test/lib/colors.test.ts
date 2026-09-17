import { describe, expect, it } from "vitest";
import { getGradient } from "@/lib/colors";

const KNOWN_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-700",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-purple-700",
];

describe("getGradient", () => {
  it("is deterministic for the same id", () => {
    expect(getGradient("board-1")).toBe(getGradient("board-1"));
    expect(getGradient("workspace-42")).toBe(getGradient("workspace-42"));
  });

  it("always returns one of the known gradient classes", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(KNOWN_GRADIENTS).toContain(getGradient(`seed-${i}`));
    }
  });
});