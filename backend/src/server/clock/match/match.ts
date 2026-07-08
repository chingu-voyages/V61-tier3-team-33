import { MATCH, type ClockFormat } from "../../types";
import type { Clock } from "../clock";

export abstract class MatchClock implements Clock {
  readonly type = MATCH
  abstract readonly initialMs: number
  abstract readonly format: ClockFormat

  /** {@inheritDoc} */
  abstract onMove(remainingMs: number, elapsedMs: number): number

  /** {@inheritDoc} */
  onTurn(): number {
    return 0
  }
}
