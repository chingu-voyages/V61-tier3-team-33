import { logger as rootLogger } from "../../../logging/logger";
import { CASUAL } from "../../types";
import { MoveClock } from "./move";

const log = rootLogger.child({ module: "CasualClock" });

export class CasualClock extends MoveClock {
  readonly format = CASUAL;
  readonly initialMs = 600_000;

  constructor() {
    super();
    log.info("[CasualClock.constructor:created]", { format: this.format, initialMs: this.initialMs });
  }
}
