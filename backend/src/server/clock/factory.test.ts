import { describe, expect, it } from "bun:test";
import { createClock } from "./factory";
import { MOVE, BLITZ } from "../types";

describe("createClock", () => {
  it("returns blitz (1 min) when no format given", () => {
    const c = createClock();
    expect(c.initialMs).toBe(60_000);
    expect(c.type).toBe(MOVE);
  });

  it("returns blitz when passed BLITZ format", () => {
    const c = createClock(BLITZ);
    expect(c.initialMs).toBe(60_000);
    expect(c.type).toBe(MOVE);
    expect(c.onMove(50_000, 10_000)).toBe(60_000);
  });

  it("has no turn delay by default", () => {
    const c = createClock();
    expect(c.onTurn()).toBe(0);
  });

  it("has format blitz by default", () => {
    const c = createClock();
    expect(c.format).toBe(BLITZ);
  });
});
