import { logger as rootLogger } from "../../../logging/logger";
import { type ClockFormat, MATCH } from "../../types";
import type { Clock } from "../clock";

const log = rootLogger.child({ module: "MatchClock" });

export abstract class MatchClock implements Clock {
  readonly type = MATCH;
  abstract readonly initialMs: number;
  abstract readonly format: ClockFormat;

  constructor() {
    log.info("[MatchClock.constructor:created]", { type: this.type });
  }

  /** {@inheritDoc} */
  abstract onMove(remainingMs: number, elapsedMs: number): number;

  /** {@inheritDoc} */
  onTurn(): number {
    return 0;
  }
}
