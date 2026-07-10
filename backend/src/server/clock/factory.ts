import type { Clock } from "./clock";
import type { ClockFormat } from "../types";
import { BULLET, BLITZ, SWIFT, STEADY, PATIENT, CASUAL } from "../types";
import { BulletClock }  from "./move/bullet";
import { BlitzClock }   from "./move/blitz";
import { SwiftClock }   from "./move/swift";
import { SteadyClock }  from "./move/steady";
import { PatientClock } from "./move/patient";
import { CasualClock }  from "./move/casual";

export function createClock(format?: ClockFormat): Clock {
    switch (format) {
        case BULLET:  return new BulletClock();
        case BLITZ:   return new BlitzClock();
        case SWIFT:   return new SwiftClock();
        case STEADY:  return new SteadyClock();
        case PATIENT: return new PatientClock();
        case CASUAL:  return new CasualClock();
        default:      return new BlitzClock();
    }
}
