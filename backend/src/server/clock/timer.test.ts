import { afterEach, describe, expect, it, mock } from "bun:test";

import type { Publisher } from "../events/hub";
import { CLOCK_EXPIRED, CLOCK_PAUSED, CLOCK_STARTED } from "../protocol/events";
import { DEFAULT, MATCH, MOVE } from "../types";
import { BLACK, WHITE } from "../types";
import type { Clock } from "./clock";
import { ClockTimer } from "./timer";

function makePublisher(): Publisher {
  return { emit: mock(() => {}) };
}

/** A mock move-type strategy: onMove resets to initialMs, onTurn returns 0. */
function mockMoveStrategy(initialMs = 300_000): Clock {
  return {
    type: MOVE,
    format: DEFAULT,
    initialMs,
    onMove: mock((_remaining: number, _elapsed: number) => initialMs),
    onTurn: mock(() => 0),
  };
}

/** A mock match-type strategy: onMove subtracts elapsed, onTurn returns 0. */
function mockMatchStrategy(initialMs = 300_000): Clock {
  return {
    type: MATCH,
    format: DEFAULT,
    initialMs,
    onMove: mock((remaining: number, elapsed: number) => remaining - elapsed),
    onTurn: mock(() => 0),
  };
}

const RealNow = Date.now;

/**
 * Advances time deterministically in a ClockTimer by casting the frozen
 * Date.now to a controlled value. Call `freezeTime` before every test that
 * cares about elapsed.
 */
function freezeTime(at: number): void {
  Date.now = mock(() => at);
}

describe("ClockTimer", () => {
  afterEach(() => {
    // Restore real Date.now after any test that mocked it via freezeTime.
    Date.now = RealNow;
  });

  describe("start", () => {
    it("sets initial times and activates the given color", () => {
      const strategy = mockMoveStrategy();
      const timer = new ClockTimer(strategy, "room-1", makePublisher());

      timer.start(300_000, 300_000, WHITE);

      expect(timer.state.whiteMs).toBeGreaterThan(299_990);
      expect(timer.state.blackMs).toBe(300_000);
      expect(timer.state.active).toBe(WHITE);
    });

    it("emits CLOCK_STARTED with the correct values", () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher);

      timer.start(300_000, 300_000, WHITE);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_STARTED,
          roomId: "room-1",
          color: WHITE,
          remainingMs: 300_000,
        }),
      );
    });

    it("emits CLOCK_EXPIRED when remaining time elapses", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher);

      timer.start(1, 300_000, WHITE);

      await Bun.sleep(20);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_EXPIRED,
          roomId: "room-1",
          color: WHITE,
        }),
      );
    });
  });

  describe("stop", () => {
    it("calls strategy.onMove with correct remaining and elapsed", () => {
      freezeTime(100_000);
      const strategy = mockMoveStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000); // 5s elapsed
      timer.stop(WHITE);

      expect(strategy.onMove).toHaveBeenCalledWith(300_000, 5_000);
    });

    it("returns the new remaining after strategy.onMove", () => {
      freezeTime(100_000);
      const strategy = mockMoveStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      const result = timer.stop(WHITE);

      expect(result).toBe(300_000); // move strategy resets to initialMs
    });

    it("emits CLOCK_PAUSED with the correct values", () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher);
      freezeTime(100_000);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      timer.stop(WHITE);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_PAUSED,
          roomId: "room-1",
          color: WHITE,
          remainingMs: 300_000, // move strategy resets to initialMs
        }),
      );
    });

    it("subtracts elapsed time with a match strategy", () => {
      freezeTime(100_000);
      const strategy = mockMatchStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      const result = timer.stop(WHITE);

      expect(result).toBe(295_000); // 300_000 - 5_000 elapsed
      expect(strategy.onMove).toHaveBeenCalledWith(300_000, 5_000);
    });

    it("uses 0 elapsed when stop is called during opponent's delay", () => {
      freezeTime(100_000);
      const strategy: Clock = {
        type: MOVE,
        format: DEFAULT,
        initialMs: 300_000,
        onMove: mock((r: number) => r),
        onTurn: mock(() => 100), // 100ms Bronstein delay
      };
      const timer = new ClockTimer(strategy, "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      freezeTime(110_000);
      timer.stop(WHITE);

      // startNext with 100ms delay — clock hasn't started for BLACK yet
      timer.startNext(BLACK);
      expect(timer.state.active).toBeNull(); // delay running

      // Opponent moves before their clock starts — stop should use 0 elapsed
      timer.stop(BLACK);

      expect(strategy.onMove).toHaveBeenCalledWith(300_000, 0);
    });
  });

  describe("startNext", () => {
    it("starts the given color with full time after stop", () => {
      freezeTime(100_000);
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      timer.stop(WHITE);

      timer.startNext(BLACK);

      expect(timer.state.active).toBe(BLACK);
    });

    it("honors delay from strategy.onTurn", async () => {
      const strategy: Clock = {
        type: MOVE,
        format: DEFAULT,
        initialMs: 300_000,
        onMove: mock((r: number) => r),
        onTurn: mock(() => 50), // 50ms delay
      };
      const timer = new ClockTimer(strategy, "room-1", makePublisher());
      freezeTime(100_000);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      timer.stop(WHITE);

      timer.startNext(BLACK);
      expect(timer.state.active).toBeNull(); // delayed, not yet active

      await Bun.sleep(100);
      expect(timer.state.active).toBe(BLACK);
    });

    it("applies penalty strategy when over time", () => {
      // A penalty strategy that subtracts 10_000ms per move
      const penaltyStrategy: Clock = {
        type: MOVE,
        format: DEFAULT,
        initialMs: 300_000,
        onMove: mock((remaining: number, _elapsed: number) => Math.max(0, remaining - 10_000)),
        onTurn: mock(() => 0),
      };
      freezeTime(100_000);
      const timer = new ClockTimer(penaltyStrategy, "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      const result = timer.stop(WHITE);

      expect(result).toBe(290_000); // 300_000 - 10_000 penalty
    });
  });

  describe("dispose", () => {
    it("sets active to null", () => {
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher());
      timer.start(300_000, 300_000, WHITE);

      timer.dispose();

      expect(timer.state.active).toBeNull();
    });

    it("does not emit CLOCK_EXPIRED after dispose", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher);
      timer.start(1, 300_000, WHITE);

      timer.dispose();

      await Bun.sleep(20);

      const expiredCalls = (publisher.emit as ReturnType<typeof mock>).mock.calls.filter(
        (c: unknown[]) => c[0] && typeof c[0] === "object" && (c[0] as Record<string, unknown>).type === CLOCK_EXPIRED,
      );
      expect(expiredCalls.length).toBe(0);
    });
  });

  describe("expiry", () => {
    it("emits CLOCK_EXPIRED when time reaches 0", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher);

      timer.start(1, 300_000, WHITE);

      await Bun.sleep(20);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_EXPIRED,
          roomId: "room-1",
          color: WHITE,
        }),
      );
    });

    it("emits CLOCK_EXPIRED only once", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher);
      timer.start(1, 300_000, WHITE);

      await Bun.sleep(20);

      (publisher.emit as ReturnType<typeof mock>).mockClear();
      await Bun.sleep(20);

      const expiredCalls = (publisher.emit as ReturnType<typeof mock>).mock.calls.filter(
        (c: unknown[]) => c[0] && typeof c[0] === "object" && (c[0] as Record<string, unknown>).type === CLOCK_EXPIRED,
      );
      expect(expiredCalls.length).toBe(0);
    });

    it("sets active to null and time to 0 on expiry", async () => {
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher());
      timer.start(1, 300_000, WHITE);

      await Bun.sleep(20);

      expect(timer.state.active).toBeNull();
      expect(timer.state.whiteMs).toBe(0);
    });
  });

  describe("stop/startNext cycle", () => {
    it("does not expire the other color after stop/startNext", async () => {
      const timer = new ClockTimer(mockMatchStrategy(100_000), "room-1", makePublisher());
      freezeTime(100_000);
      timer.start(100_000, 50_000, WHITE);

      freezeTime(103_000);
      timer.stop(WHITE);

      freezeTime(103_000);
      timer.startNext(BLACK);

      // White's time is frozen after stop, only black's timer runs
      expect(timer.state.whiteMs).toBe(97_000); // 100_000 - 3_000 elapsed
      expect(timer.state.active).toBe(BLACK);
    });
  });

  describe("strategy integration", () => {
    it("honors a match strategy across a full push/pop cycle", async () => {
      const strategy = mockMatchStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher());
      freezeTime(100_000);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(110_000); // 10s elapsed for white
      timer.stop(WHITE);
      expect(timer.state.whiteMs).toBe(290_000); // 300_000 - 10_000

      timer.startNext(BLACK);
      freezeTime(115_000); // 5s elapsed for black
      timer.stop(BLACK);
      expect(timer.state.blackMs).toBe(295_000); // 300_000 - 5_000

      timer.startNext(WHITE);
      expect(timer.state.active).toBe(WHITE);
    });
  });
});
