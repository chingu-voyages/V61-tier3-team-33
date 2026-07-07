import type { Clock } from "./clock";
import type { ClockFormat } from "./types";
import { MOVE, DEFAULT } from "./types";

function defaultClock(): Clock {
  return new DefaultClock();
}

export function createClock(format?: ClockFormat): Clock {
  if (!format) return defaultClock();

  switch (format) {
    // case YOUR_FORMAT: return new YourStrategy();
    default:
      // TODO: delete this default after implementing real strategies
      return new DefaultClock();
  }
}

// TODO: delete after implementing real strategies
class DefaultClock implements Clock {
  readonly type = MOVE;
  readonly format = DEFAULT;
  readonly initialMs = 300_000;
  onMove(): number {
    return this.initialMs;
  }
  onTurn(): number {
    return 0;
  }
}
