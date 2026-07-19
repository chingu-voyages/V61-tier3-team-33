import { type ClockFormat, MOVE } from "../../types";
import type { Clock } from "../clock";

export abstract class MoveClock implements Clock {
  readonly type = MOVE;
  abstract readonly initialMs: number;
  abstract readonly format: ClockFormat;

  /** {@inheritDoc} */
  onMove(_remainingMs: number, _elapsedMs: number): number {
    return this.initialMs;
  }

  /** {@inheritDoc} */
  onTurn(): number {
    return 0;
  }
}
