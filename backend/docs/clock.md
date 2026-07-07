# Clock Strategies

The clock system separates the **time-control strategy** (`Clock` interface) from the **ticking timer** (`ClockTimer`).

## Adding a strategy — step by step

### 1. Create your strategy class

Pick a base class depending on how time should behave:

| Base class | Behavior | Override |
|---|---|---|
| `MoveClock` | Time resets to `initialMs` each turn | `onMove` / `onTurn` (optional) |
| `MatchClock` | Time ticks down across the whole game | `onMove` (required) |

**1. Register the format constant in `types.ts`:**

```ts
// types.ts
export const BLITZ = ClockFormat("blitz");
export const FISCHER = ClockFormat("fischer");
```

**2. Create the strategy class, importing the format from `types.ts`:**

Per-move (time resets each turn):

```ts
import { MoveClock } from "./move/move";
import { BLITZ } from "../types";

export class Blitz extends MoveClock {
  readonly initialMs: number;
  readonly format = BLITZ;
  constructor(initialMs = 30_000) { super(); this.initialMs = initialMs; }
}
```

Match-length (time accumulates across the whole game):

```ts
import { MatchClock } from "./match/match";
import { FISCHER } from "../types";

export class Fischer extends MatchClock {
  readonly initialMs: number;
  readonly format = FISCHER;
  private incrementMs: number;
  constructor(initialMs: number, incrementMs: number) {
    super();
    this.initialMs = initialMs;
    this.incrementMs = incrementMs;
  }
  onMove(remainingMs: number, elapsedMs: number): number {
    return Math.max(0, remainingMs - elapsedMs + this.incrementMs);
  }
}
```

If neither base class fits, implement `Clock` directly.

### 2. Wire into the factory

Add a `case` to the switch in `factory.ts` and delete the default stub:

```ts
// factory.ts — delete DefaultClock class and defaultClock() function too
case BLITZ:   return new Blitz();
case FISCHER: return new Fischer();
```

**Don't forget to remove** the `DefaultClock` class, the `defaultClock()` function, and the `// TODO` comments when you wire in your first real strategy.

### 3. Test your strategy

The timer tests in `timer.test.ts` use **mock** strategies — they already cover the timer lifecycle and work with any `Clock` implementation. Add strategy-specific tests in a file next to your class:

```ts
// clock/move/blitz.test.ts
import { Blitz } from "./blitz";
import { MOVE, BLITZ } from "../types";

describe("Blitz", () => {
  it("defaults to 30s", () => {
    expect(new Blitz().initialMs).toBe(30_000);
  });
  it("resets on move", () => {
    expect(new Blitz().onMove(10_000, 5_000)).toBe(30_000);
  });
});
```

### 4. Use your strategy

Pass the format constant when creating a game:

```ts
createGame(BLITZ)
```

---

## Reference

### `Clock` interface (`clock.ts`)

| Member | Description |
|---|---|
| `type` | `MOVE` or `MATCH` |
| `initialMs` | Starting time per side (ms) |
| `format` | Format identifier for factory dispatch |
| `onMove(remainingMs, elapsedMs)` | Returns new remaining time after a move |
| `onTurn()` | Returns delay before opponent's clock starts (ms) |

### `Timer` interface (`timer.ts`)

| Method | When it's called |
|---|---|
| `start()` | Game transitions from WAITING to ACTIVE |
| `stop()` / `startNext()` | Each move |
| `dispose()` | Game ends |

Emits `CLOCK_STARTED`, `CLOCK_PAUSED`, `CLOCK_TICK`, `CLOCK_EXPIRED`.

### Factory (`factory.ts`)

```ts
createClock(format?: ClockFormat): Clock
```

With no format it returns a default 5‑minute per‑move clock.
