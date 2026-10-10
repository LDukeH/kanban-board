import { describe, expect, it } from "vitest";
import {
  applyTaskCompletion,
  nextCompletionState,
} from "@/lib/taskToggle";
import { makeTask } from "../fixtures";

describe("task completion toggle", () => {
  it("flips the completion state", () => {
    expect(nextCompletionState(false)).toBe(true);
    expect(nextCompletionState(true)).toBe(false);
  });

  it("updates only the toggled task in the cached list", () => {
    const tasks = [
      makeTask({ id: "t1", completed: false }),
      makeTask({ id: "t2", completed: true }),
    ];
    const next = applyTaskCompletion(tasks, "t1", true);
    expect(next.map((task) => task.completed)).toEqual([true, true]);
    // Pure update: the input list is untouched so rollback can restore it.
    expect(tasks[0].completed).toBe(false);
  });

  it("leaves the list unchanged for an unknown task", () => {
    const tasks = [makeTask({ id: "t1", completed: false })];
    expect(applyTaskCompletion(tasks, "missing", true)).toEqual(tasks);
  });
});