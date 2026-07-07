import { describe, expect, it, afterEach, mock } from "bun:test";
import { MOVE, MATCH, DEFAULT } from "./types";
import type { Clock } from "./clock";
import { ClockTimer } from "./timer";
import type { Publisher } from "../bus/bus";
import { WHITE, BLACK } from "../domain/types";
import { CLOCK_STARTED, CLOCK_PAUSED, CLOCK_EXPIRED, CLOCK_TICK } from "../protocol/events";

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



// TICK_INTERVAL_MS must be short for tick tests to pass quickly.
// ClockTimer accepts tickIntervalMs as 4th constructor param.
// Windows min timer resolution ~15ms, so use 50ms to stay well above that.
const FAST_TICK = 50;

describe("ClockTimer", () => {
  afterEach(() => {
    // Restore real Date.now after any test that mocked it via freezeTime.
    Date.now = RealNow;
  });

  describe("start", () => {
    it("sets initial times and activates the given color", () => {
      const strategy = mockMoveStrategy();
      const timer = new ClockTimer(strategy, "room-1", makePublisher(), FAST_TICK);

      timer.start(300_000, 300_000, WHITE);

      expect(timer.state.whiteMs).toBe(300_000);
      expect(timer.state.blackMs).toBe(300_000);
      expect(timer.state.active).toBe(WHITE);
    });

    it("emits CLOCK_STARTED with the correct values", () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);

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

    it("starts ticking after start", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);

      timer.start(200_000, 200_000, WHITE);

      // Wait for at least one tick
      await Bun.sleep(FAST_TICK * 2);

      // A tick should have fired
      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: CLOCK_TICK }),
      );
    });
  });

  describe("stop", () => {
    it("calls strategy.onMove with correct remaining and elapsed", () => {
      freezeTime(100_000);
      const strategy = mockMoveStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher(), FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000); // 5s elapsed
      timer.stop(WHITE);

      expect(strategy.onMove).toHaveBeenCalledWith(300_000, 5_000);
    });

    it("returns the new remaining after strategy.onMove", () => {
      freezeTime(100_000);
      const strategy = mockMoveStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher(), FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      const result = timer.stop(WHITE);

      expect(result).toBe(300_000); // move strategy resets to initialMs
    });

    it("emits CLOCK_PAUSED with correct values", () => {
      freezeTime(100_000);
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      timer.stop(WHITE);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_PAUSED,
          roomId: "room-1",
          color: WHITE,
          remainingMs: 300_000,
        }),
      );
    });

    it("sets active to null after stop", () => {
      freezeTime(100_000);
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher(), FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      timer.stop(WHITE);

      expect(timer.state.active).toBeNull();
    });

    it("works with a match strategy (keeps remaining)", () => {
      freezeTime(100_000);
      const strategy = mockMatchStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher(), FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      freezeTime(105_000);
      const result = timer.stop(WHITE);

      expect(result).toBe(295_000); // 300_000 - 5_000 elapsed
      expect(strategy.onMove).toHaveBeenCalledWith(300_000, 5_000);
    });

    it("clamps remaining to 0 via strategy (never negative)", () => {
      freezeTime(100_000);
      // A strategy that returns negative if remaining < elapsed
      const penaltyStrategy: Clock = {
        type: MATCH,
        format: DEFAULT,
        initialMs: 300_000,
        onMove: mock((remaining: number, _elapsed: number) => Math.max(0, remaining - 500_000)),
        onTurn: mock(() => 0),
      };
      const timer = new ClockTimer(penaltyStrategy, "room-1", makePublisher(), FAST_TICK);
      timer.start(10_000, 10_000, WHITE);

      freezeTime(110_000);
      const result = timer.stop(WHITE);

      expect(result).toBe(0); // clamped by Math.max(0, ...) inside timer.stop
    });
  });

  describe("startNext", () => {
    it("calls strategy.onTurn", () => {
      const strategy = mockMoveStrategy();
      const timer = new ClockTimer(strategy, "room-1", makePublisher(), FAST_TICK);
      timer.start(300_000, 300_000, WHITE);
      timer.stop(WHITE);

      timer.startNext(BLACK);

      expect(strategy.onTurn).toHaveBeenCalled();
    });

    it("immediately resumes ticking for delay 0", async () => {
      const publisher = makePublisher();
      const strategy = mockMoveStrategy(); // onTurn returns 0
      const timer = new ClockTimer(strategy, "room-1", publisher, FAST_TICK);
      timer.start(300_000, 300_000, WHITE);
      timer.stop(WHITE);

      timer.startNext(BLACK);

      expect(timer.state.active).toBe(BLACK);
      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_STARTED,
          color: BLACK,
        }),
      );
    });
  });

  describe("dispose", () => {
    it("sets active to null", () => {
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher(), FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      timer.dispose();

      expect(timer.state.active).toBeNull();
    });

    it("stops ticking after dispose", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);
      timer.start(300_000, 300_000, WHITE);

      timer.dispose();
      (publisher.emit as ReturnType<typeof mock>).mockClear();

      await Bun.sleep(FAST_TICK * 3);

      // No more ticks should fire after dispose
      const tickCalls = (publisher.emit as ReturnType<typeof mock>).mock.calls.filter(
        (c: any[]) => c[0]?.type === CLOCK_TICK,
      );
      expect(tickCalls.length).toBe(0);
    });
  });

  describe("tick loop — expiry", () => {
    it("emits CLOCK_EXPIRED when time reaches 0", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);

      // Start with very little time so it expires within a tick or two
      timer.start(1, 300_000, WHITE);

      // Wait for expiry
      await Bun.sleep(FAST_TICK * 5);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CLOCK_EXPIRED,
          roomId: "room-1",
          color: WHITE,
        }),
      );
    });

    it("stops ticking after expiry", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);
      timer.start(1, 300_000, WHITE);

      await Bun.sleep(FAST_TICK * 5);

      // Clear calls, wait more, should see no new CLOCK_EXPIRED
      (publisher.emit as ReturnType<typeof mock>).mockClear();
      await Bun.sleep(FAST_TICK * 3);

      const expiredCalls = (publisher.emit as ReturnType<typeof mock>).mock.calls.filter(
        (c: any[]) => c[0]?.type === CLOCK_EXPIRED,
      );
      expect(expiredCalls.length).toBe(0);
    });

    it("sets active to null and time to 0 on expiry", async () => {
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher(), FAST_TICK);
      timer.start(1, 300_000, WHITE);

      await Bun.sleep(FAST_TICK * 5);

      expect(timer.state.active).toBeNull();
      expect(timer.state.whiteMs).toBe(0);
    });
  });

  describe("tick loop — decrement", () => {
    it("decrements remaining time for the active player", async () => {
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", makePublisher(), FAST_TICK);
      timer.start(100_000, 200_000, WHITE);

      const before = timer.state.whiteMs;
      await Bun.sleep(FAST_TICK * 3);

      expect(timer.state.whiteMs).toBeLessThan(before);
      expect(timer.state.blackMs).toBe(200_000); // untouched
    });

    it("emits CLOCK_TICK each tick", async () => {
      const publisher = makePublisher();
      const timer = new ClockTimer(mockMoveStrategy(), "room-1", publisher, FAST_TICK);
      timer.start(100_000, 100_000, WHITE);

      await Bun.sleep(FAST_TICK * 3);

      const tickCalls = (publisher.emit as ReturnType<typeof mock>).mock.calls.filter(
        (c: any[]) => c[0]?.type === CLOCK_TICK,
      );
      expect(tickCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("does not tick for the other color after stop/startNext", async () => {
      const timer = new ClockTimer(mockMatchStrategy(100_000), "room-1", makePublisher(), FAST_TICK);
      freezeTime(100_000);
      timer.start(100_000, 50_000, WHITE);

      freezeTime(103_000);
      timer.stop(WHITE);

      freezeTime(103_000);
      timer.startNext(BLACK);

      // Restore real time so the tick loop can actually tick
      Date.now = RealNow;
      await Bun.sleep(FAST_TICK * 3);

      // Black's time should have decreased, white's should be frozen
      expect(timer.state.blackMs).toBeLessThan(50_000);
    });
  });

  describe("strategy integration", () => {
    it("honors a match strategy across a full push/pop cycle", async () => {
      const strategy = mockMatchStrategy(300_000);
      const timer = new ClockTimer(strategy, "room-1", makePublisher(), FAST_TICK);
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
