import { describe, expect, it } from "bun:test";
import { Grace } from "./grace";
import { WHITE, BLACK } from "../types";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("Grace", () => {
  it("fires onExpire after the timeout", async () => {
    const timer = new Grace();
    const expired = { called: false };

    timer.start("room-1", WHITE, 5, () => {
      expired.called = true;
    });

    await delay(20);
    expect(expired.called).toBe(true);
  });

  it("does not fire onExpire if cancelled before timeout", async () => {
    const timer = new Grace();
    const expired = { called: false };

    timer.start("room-1", WHITE, 10, () => {
      expired.called = true;
    });

    timer.cancel("room-1");
    await delay(20);
    expect(expired.called).toBe(false);
  });

  it("returns a deadline in the future on start", () => {
    const timer = new Grace();
    const now = Date.now();

    const deadline = timer.start("room-1", WHITE, 30_000, () => {});

    expect(deadline).toBeGreaterThan(now);
    expect(deadline - now).toBeGreaterThanOrEqual(30_000);
    expect(deadline - now).toBeLessThan(30_010);
  });

  it("getDeadline returns null for unknown room", () => {
    const timer = new Grace();
    expect(timer.getDeadline("room-unknown")).toBeNull();
  });

  it("getDeadline returns the deadline for a running timer", () => {
    const timer = new Grace();
    const deadline = timer.start("room-1", WHITE, 30_000, () => {});

    expect(timer.getDeadline("room-1")).toBe(deadline);
  });

  it("cancel returns true if a timer was cancelled", () => {
    const timer = new Grace();
    timer.start("room-1", WHITE, 30_000, () => {});

    expect(timer.cancel("room-1")).toBe(true);
    expect(timer.cancel("room-1")).toBe(false); // already gone
  });

  it("cancel returns false for unknown room", () => {
    const timer = new Grace();
    expect(timer.cancel("room-none")).toBe(false);
  });

  it("start replaces an existing timer for the same room", async () => {
    const timer = new Grace();
    const order: string[] = [];

    timer.start("room-1", WHITE, 5, () => order.push("first"));
    timer.start("room-1", BLACK, 10, () => order.push("second"));

    await delay(30);

    // Only the second callback should have fired
    expect(order).toEqual(["second"]);
  });

  it("clear cancels all timers", async () => {
    const timer = new Grace();
    const expired = { a: false, b: false };

    timer.start("room-a", WHITE, 5, () => {
      expired.a = true;
    });
    timer.start("room-b", BLACK, 5, () => {
      expired.b = true;
    });

    timer.clear();
    await delay(20);

    expect(expired.a).toBe(false);
    expect(expired.b).toBe(false);
  });

  it("clear is safe to call with no timers", () => {
    const timer = new Grace();
    timer.clear(); // should not throw
  });
});
