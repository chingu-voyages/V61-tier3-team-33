import { logger as rootLogger } from "../../../logging/logger";
import { BULLET } from "../../types";
import { MoveClock } from "./move";

const log = rootLogger.child({ module: "BulletClock" });

export class BulletClock extends MoveClock {
  readonly format = BULLET;
  readonly initialMs = 30_000;

  constructor() {
    super();
    log.info("[BulletClock.constructor:created]", { format: this.format, initialMs: this.initialMs });
  }
}
