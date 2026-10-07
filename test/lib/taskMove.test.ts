import { describe, expect, it } from "vitest";
import {
  columnGateKey,
  resolveMoveColumns,
  touchedColumnGateKeys,
} from "@/lib/taskMove";

describe("taskMove pure helpers (mirrors useColumnTasks behavior)", () => {
  it("scopes a column gate key to its board", () => {
    expect(columnGateKey("b1", "c1")).toBe("b1:c1");
    expect(columnGateKey("b2", "c1")).not.toBe(columnGateKey("b1", "c1"));
  });

  it("defaults the move source to the hook column when omitted", () => {
    expect(resolveMoveColumns("c-hook", undefined)).toBe("c-hook");
    expect(resolveMoveColumns("c-hook", "c-explicit")).toBe("c-explicit");
  });

  it("touches source and target gates once even for same-column moves", () => {
    expect(touchedColumnGateKeys("b1", "c1", "c1")).toEqual(["b1:c1"]);
    expect(touchedColumnGateKeys("b1", "c1", "c2")).toEqual(["b1:c1", "b1:c2"]);
  });
});
