import { describe, expect, it } from "vitest";
import { getGradient, getLabelContrastText, LABEL_COLORS } from "@/lib/colors";

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

describe("getLabelContrastText", () => {
  it("uses dark text on bright label colors", () => {
    expect(getLabelContrastText("#f5c518")).toBe("#000000");
    expect(getLabelContrastText("#f4881f")).toBe("#000000");
    expect(getLabelContrastText("#ffffff")).toBe("#000000");
  });

  it("uses white text on saturated/dark label colors", () => {
    expect(getLabelContrastText("#e11941")).toBe("#ffffff");
    expect(getLabelContrastText("#0cb64e")).toBe("#ffffff");
    expect(getLabelContrastText("#0ca0d9")).toBe("#ffffff");
    expect(getLabelContrastText("#5a67d8")).toBe("#ffffff");
    expect(getLabelContrastText("#000000")).toBe("#ffffff");
  });

  it("handles short hex and missing hash", () => {
    expect(getLabelContrastText("#fff")).toBe("#000000");
    expect(getLabelContrastText("000")).toBe("#ffffff");
  });

  it("falls back to white for empty/invalid input", () => {
    expect(getLabelContrastText("")).toBe("#ffffff");
    expect(getLabelContrastText("not-a-color")).toBe("#ffffff");
  });

  it("returns a readable color for every built-in label color", () => {
    for (const color of LABEL_COLORS) {
      expect(["#000000", "#ffffff"]).toContain(getLabelContrastText(color));
    }
  });
});