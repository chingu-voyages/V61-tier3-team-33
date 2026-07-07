import { describe, expect, it } from "bun:test";
import { createClock } from "./factory";
import { MOVE, DEFAULT } from "./types";

describe("createClock", () => {
  it("returns a default strategy with 5 min when no config given", () => {
    const c = createClock();
    expect(c.initialMs).toBe(300_000);
    expect(c.type).toBe(MOVE);
  });

  it("returns default strategy with custom initialMs", () => {
    const c = createClock({ format: DEFAULT, initialMs: 60_000 });
    expect(c.initialMs).toBe(60_000);
  });

  it("returns a move-type strategy (no carry-over between moves)", () => {
    const c = createClock({ format: DEFAULT, initialMs: 120_000 });
    expect(c.type).toBe(MOVE);
    expect(c.onMove(50_000, 10_000)).toBe(120_000);
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
