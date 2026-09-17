import { describe, expect, it } from "vitest";
import {
  countTasksAbovePointer,
  insertTaskIntoColumn,
  orderTasksByPosition,
  removeTaskFromColumn,
  reorderColumns,
} from "@/lib/dragDrop";
import { makeColumn, makeLabel, makeTask } from "../fixtures";

describe("orderTasksByPosition", () => {
  it("returns tasks sorted by ascending position", () => {
    const tasks = [
      makeTask({ id: "b", position: 1 }),
      makeTask({ id: "a", position: 0 }),
      makeTask({ id: "c", position: 2 }),
    ];
    expect(orderTasksByPosition(tasks).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array and returns a fresh array", () => {
    const tasks = [
      makeTask({ id: "b", position: 1 }),
      makeTask({ id: "a", position: 0 }),
    ];
    const inputSnapshot = [...tasks];
    const result = orderTasksByPosition(tasks);
    expect(tasks).toEqual(inputSnapshot);
    expect(result).not.toBe(tasks);
  });

  it("preserves task object fields", () => {
    const task = makeTask({ title: "Keep me", position: 5 });
    const [sorted] = orderTasksByPosition([task]);
    expect(sorted).toEqual(task);
  });

  it("handles empty and single-item lists", () => {
    expect(orderTasksByPosition([])).toEqual([]);
    const task = makeTask();
    expect(orderTasksByPosition([task])).toEqual([task]);
  });
});

describe("removeTaskFromColumn", () => {
  it("removes the requested task and renumbers the rest from zero", () => {
    const tasks = [
      makeTask({ id: "t1", position: 0 }),
      makeTask({ id: "t2", position: 1 }),
      makeTask({ id: "t3", position: 2 }),
    ];
    const result = removeTaskFromColumn(tasks, "t2");
    expect(result.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(result.map((t) => t.position)).toEqual([0, 1]);
  });

  it("sorts by the original positions before renumbering", () => {
    const tasks = [
      makeTask({ id: "later", position: 2 }),
      makeTask({ id: "now", position: 0 }),
      makeTask({ id: "mid", position: 1 }),
    ];
    const result = removeTaskFromColumn(tasks, "mid");
    expect(result.map((t) => t.id)).toEqual(["now", "later"]);
    expect(result.map((t) => t.position)).toEqual([0, 1]);
  });

  it("returns a fresh array and leaves the input unchanged", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const inputSnapshot = JSON.parse(JSON.stringify(tasks));
    const result = removeTaskFromColumn(tasks, "t1");
    expect(result).not.toBe(tasks);
    expect(tasks).toEqual(inputSnapshot);
  });

  it("handles a missing task id without corrupting positions", () => {
    const tasks = [
      makeTask({ id: "t1", position: 3 }),
      makeTask({ id: "t2", position: 1 }),
    ];
    const result = removeTaskFromColumn(tasks, "no-such-task");
    expect(result.map((t) => t.id)).toEqual(["t2", "t1"]);
    expect(result.map((t) => t.position)).toEqual([0, 1]);
  });
});
describe("insertTaskIntoColumn", () => {
  const existing = () => [
    makeTask({ id: "t1", position: 0 }),
    makeTask({ id: "t2", position: 1 }),
  ];

  it("inserts at the beginning, middle, and end", () => {
    const incoming = makeTask({ id: "new", position: 99 });

    const atStart = insertTaskIntoColumn(existing(), incoming, "col-1", 0);
    expect(atStart.map((t) => t.id)).toEqual(["new", "t1", "t2"]);
    expect(atStart.map((t) => t.position)).toEqual([0, 1, 2]);

    const atMiddle = insertTaskIntoColumn(existing(), incoming, "col-1", 1);
    expect(atMiddle.map((t) => t.id)).toEqual(["t1", "new", "t2"]);
    expect(atMiddle.map((t) => t.position)).toEqual([0, 1, 2]);

    const atEnd = insertTaskIntoColumn(existing(), incoming, "col-1", 2);
    expect(atEnd.map((t) => t.id)).toEqual(["t1", "t2", "new"]);
    expect(atEnd.map((t) => t.position)).toEqual([0, 1, 2]);
  });

  it("clamps a negative position to zero", () => {
    const result = insertTaskIntoColumn(existing(), makeTask({ id: "new" }), "col-1", -5);
    expect(result[0].id).toBe("new");
  });

  it("clamps an oversized position to the end", () => {
    const result = insertTaskIntoColumn(existing(), makeTask({ id: "new" }), "col-1", 99);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2", "new"]);
  });

  it("treats a non-finite position as the start", () => {
    const nanResult = insertTaskIntoColumn(
      existing(),
      makeTask({ id: "new" }),
      "col-1",
      Number.NaN,
    );
    expect(nanResult[0].id).toBe("new");

    const infResult = insertTaskIntoColumn(
      existing(),
      makeTask({ id: "inf" }),
      "col-1",
      Number.POSITIVE_INFINITY,
    );
    expect(infResult.at(0)?.id).toBe("inf");
  });

  it("moves an existing task without duplicating it", () => {
    const tasks = [
      makeTask({ id: "t1", position: 0 }),
      makeTask({ id: "t2", position: 1 }),
      makeTask({ id: "t3", position: 2 }),
    ];
    const result = insertTaskIntoColumn(tasks, makeTask({ id: "t1" }), "col-1", 2);
    expect(result.filter((t) => t.id === "t1")).toHaveLength(1);
    expect(result.map((t) => t.id)).toEqual(["t2", "t3", "t1"]);
    expect(result.map((t) => t.position)).toEqual([0, 1, 2]);
  });

  it("sets the task's columnId to the destination column", () => {
    const result = insertTaskIntoColumn(
      [],
      makeTask({ id: "t1", columnId: "src" }),
      "dest",
      0,
    );
    expect(result[0].columnId).toBe("dest");
  });

  it("does not mutate the source list or the incoming task object", () => {
    const source = [makeTask({ id: "t1", position: 0 })];
    const incoming = makeTask({ id: "new", position: 9, title: "Untouched" });
    const sourceSnapshot = JSON.parse(JSON.stringify(source));
    const incomingSnapshot = { ...incoming };

    insertTaskIntoColumn(source, incoming, "dest", 1);

    expect(source).toEqual(sourceSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });
});

describe("reorderColumns", () => {
  it("reorders by the requested position and renumbers contiguously", () => {
    const columns = [
      makeColumn({ id: "c1", position: 0 }),
      makeColumn({ id: "c2", position: 1 }),
      makeColumn({ id: "c3", position: 2 }),
    ];
    const result = reorderColumns(columns, "c3", 0);
    expect(result.map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
    expect(result.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("clamps positions at both boundaries", () => {
    const columns = [
      makeColumn({ id: "c1", position: 0 }),
      makeColumn({ id: "c2", position: 1 }),
    ];
    expect(reorderColumns(columns, "c2", -3)[0].id).toBe("c2");
    const toEnd = reorderColumns(columns, "c1", 99);
    expect(toEnd[toEnd.length - 1].id).toBe("c1");
  });

  it("returns the position-sorted list when the requested column does not exist", () => {
    const columns = [
      makeColumn({ id: "c2", position: 1 }),
      makeColumn({ id: "c1", position: 0 }),
    ];
    const result = reorderColumns(columns, "missing", 1);
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
    // The sorted list is returned as-is: positions are preserved, not renumbered.
    expect(result.map((c) => c.position)).toEqual([0, 1]);
  });

  it("does not mutate the input list", () => {
    const columns = [makeColumn({ id: "c1" }), makeColumn({ id: "c2" })];
    const snapshot = JSON.parse(JSON.stringify(columns));
    reorderColumns(columns, "c2", 0);
    expect(columns).toEqual(snapshot);
  });
});
describe("countTasksAbovePointer", () => {
  it("counts entries whose midpoint is above the pointer", () => {
    // index 0, top 0, height 20 -> midpoint 10
    const entries = [{ index: 0, top: 0, height: 20 }];
    expect(countTasksAbovePointer(entries, 11)).toBe(1);
    expect(countTasksAbovePointer(entries, 9)).toBe(0);
  });

  it("treats the exact midpoint as not above the pointer", () => {
    const entries = [
      { index: 0, top: 0, height: 20 },
      { index: 1, top: 20, height: 20 },
    ];
    expect(countTasksAbovePointer(entries, 10)).toBe(0);
    expect(countTasksAbovePointer(entries, 30)).toBe(1);
  });

  it("handles an empty list", () => {
    expect(countTasksAbovePointer([], 100)).toBe(0);
  });

  it("sorts entries by index before counting and works on non-render order", () => {
    const entries = [
      { index: 2, top: 200, height: 10 },
      { index: 0, top: 0, height: 10 },
      { index: 1, top: 100, height: 10 },
    ];
    // midpoints: 5, 105, 205 — only the first two are above pointer 200.
    expect(countTasksAbovePointer(entries, 200)).toBe(2);
  });
});

describe("cross-column move invariant", () => {
  it("removes from source, inserts into destination, and preserves unrelated fields", () => {
    const label = makeLabel({ id: "l1", name: "Bug", color: "#e11941" });
    const moving = makeTask({
      id: "t1",
      title: "First",
      labels: [label],
      assignees: [{ user_id: "u1", email: "a@b.com" }],
      position: 0,
    });
    const source = [moving, makeTask({ id: "t2", title: "Second", position: 1 })];
    const destination = [
      makeTask({ id: "t3", title: "Third", position: 0, columnId: "dest" }),
    ];

    const newSource = removeTaskFromColumn(source, moving.id);
    const newDestination = insertTaskIntoColumn(destination, moving, "dest", 1);

    // Contiguous positions on both sides.
    expect(newSource.map((t) => t.position)).toEqual([0]);
    expect(newDestination.map((t) => t.position)).toEqual([0, 1]);

    // Exactly one occurrence in the destination, with fields preserved.
    expect(newDestination.filter((t) => t.id === "t1")).toHaveLength(1);
    const moved = newDestination[1];
    expect(moved.title).toBe("First");
    expect(moved.columnId).toBe("dest");
    expect(moved.labels).toEqual([label]);
    expect(moved.assignees).toEqual([{ user_id: "u1", email: "a@b.com" }]);
  });
});