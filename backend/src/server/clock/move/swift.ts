import { logger as rootLogger } from "../../../logging/logger";
import { SWIFT } from "../../types";
import { MoveClock } from "./move";

const log = rootLogger.child({ module: "SwiftClock" });

export class SwiftClock extends MoveClock {
  readonly format = SWIFT;
  readonly initialMs = 120_000;

  constructor() {
    super();
    log.info("[SwiftClock.constructor:created]", { format: this.format, initialMs: this.initialMs });
  }
}
