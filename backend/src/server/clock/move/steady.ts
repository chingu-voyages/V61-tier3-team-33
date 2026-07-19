import { logger as rootLogger } from "../../../logging/logger";
import { STEADY } from "../../types";
import { MoveClock } from "./move";

const log = rootLogger.child({ module: "SteadyClock" });

export class SteadyClock extends MoveClock {
  readonly format = STEADY;
  readonly initialMs = 180_000;

  constructor() {
    super();
    log.info("[SteadyClock.constructor:created]", { format: this.format, initialMs: this.initialMs });
  }
}
