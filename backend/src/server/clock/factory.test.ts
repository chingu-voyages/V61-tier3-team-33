import { describe, expect, it } from "bun:test";
import { createClock } from "./factory";
import { MOVE, DEFAULT } from "../types";

describe("createClock", () => {
  it("returns a default strategy with 30s when no config given", () => {
    const c = createClock();
    expect(c.initialMs).toBe(30_000);
    expect(c.type).toBe(MOVE);
  });

  it("returns default strategy when passed DEFAULT format", () => {
    const c = createClock(DEFAULT);
    expect(c.initialMs).toBe(30_000);
    expect(c.type).toBe(MOVE);
    expect(c.onMove(50_000, 10_000)).toBe(30_000);
  });

  it("has no turn delay by default", () => {
    const c = createClock();
    expect(c.onTurn()).toBe(0);
  });

  it("has format DEFAULT", () => {
    const c = createClock();
    expect(c.format).toBe(DEFAULT);
  });
});
