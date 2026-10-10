import { describe, expect, it } from "vitest";
import {
  MAX_VISIBLE_TASK_LABELS,
  splitTaskLabels,
} from "@/lib/taskLabels";
import { makeLabel } from "../fixtures";

describe("splitTaskLabels", () => {
  it("shows every label when at most two are present", () => {
    const labels = [makeLabel({ id: "l1", name: "Bug" })];
    expect(splitTaskLabels(labels)).toEqual({ visible: labels, hidden: [] });
    expect(MAX_VISIBLE_TASK_LABELS).toBe(2);
  });

  it("collapses labels beyond the first two into hidden", () => {
    const labels = [
      makeLabel({ id: "l1", name: "Bug" }),
      makeLabel({ id: "l2", name: "Frontend" }),
      makeLabel({ id: "l3", name: "Urgent" }),
      makeLabel({ id: "l4", name: "Backend" }),
    ];
    const { visible, hidden } = splitTaskLabels(labels);
    expect(visible.map((label) => label.name)).toEqual(["Bug", "Frontend"]);
    expect(hidden.map((label) => label.name)).toEqual(["Urgent", "Backend"]);
  });

  it("handles an empty list", () => {
    expect(splitTaskLabels([])).toEqual({ visible: [], hidden: [] });
  });
});