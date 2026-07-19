import { logger as rootLogger } from "../../../logging/logger";
import { PATIENT } from "../../types";
import { MoveClock } from "./move";

const log = rootLogger.child({ module: "PatientClock" });

export class PatientClock extends MoveClock {
  readonly format = PATIENT;
  readonly initialMs = 300_000;

  constructor() {
    super();
    log.info("[PatientClock.constructor:created]", { format: this.format, initialMs: this.initialMs });
  }
}
