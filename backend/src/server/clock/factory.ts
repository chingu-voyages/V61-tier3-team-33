import { logger as rootLogger } from "../../logging/logger";
import type { ClockFormat } from "../types";
import { BLITZ, BULLET, CASUAL, PATIENT, STEADY, SWIFT } from "../types";
import type { Clock } from "./clock";
import { BlitzClock } from "./move/blitz";
import { BulletClock } from "./move/bullet";
import { CasualClock } from "./move/casual";
import { PatientClock } from "./move/patient";
import { SteadyClock } from "./move/steady";
import { SwiftClock } from "./move/swift";

const log = rootLogger.child({ module: "ClockFactory" });

export function createClock(format?: ClockFormat): Clock {
  // resolve format to the appropriate clock strategy
  const resolved = (() => {
    switch (format) {
      case BULLET:
        return new BulletClock();
      case BLITZ:
        return new BlitzClock();
      case SWIFT:
        return new SwiftClock();
      case STEADY:
        return new SteadyClock();
      case PATIENT:
        return new PatientClock();
      case CASUAL:
        return new CasualClock();
      default:
        return new BlitzClock();
    }
  })();

  // log created clock and return it
  log.info("[ClockFactory.createClock:created]", {
    format: resolved.format,
    type: resolved.type,
    initialMs: resolved.initialMs,
  });
  return resolved;
}
