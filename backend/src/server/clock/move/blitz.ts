import { logger as rootLogger } from "../../../logging/logger";
import { BLITZ } from "../../types";
import { MoveClock } from "./move";

const log = rootLogger.child({ module: "BlitzClock" });

export class BlitzClock extends MoveClock {
  readonly format = BLITZ;
  readonly initialMs = 60_000;

  constructor() {
    super();
    log.info("[BlitzClock.constructor:created]", { format: this.format, initialMs: this.initialMs });
  }
}
