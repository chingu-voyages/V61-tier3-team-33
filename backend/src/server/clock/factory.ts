import type { Clock } from "./clock";
import type { ClockConfig } from "../domain/types";
import { MOVE, DEFAULT } from "./types";

function defaultClock(): Clock {
  return new DefaultClock();
}

export function createClock(config?: ClockConfig): Clock {
  if (!config) return defaultClock();

  switch (config.format) {
    // case YOUR_FORMAT: return new YourStrategy(config.initialMs, config.incrementMs);
    default:
      // TODO: delete this default after implementing real strategies
      return new DefaultClock(config.initialMs);
  }
}

// TODO: delete after implementing real strategies
class DefaultClock implements Clock {
  readonly type = MOVE;
  readonly format = DEFAULT;
  constructor(readonly initialMs = 300_000) {}
  onMove(): number {
    return this.initialMs;
  }
  onTurn(): number {
    return 0;
  }
}
