import type { Clock } from "./clock";
import type { ClockFormat } from "../types";
import { BULLET, RAPID_2, RAPID_3, RAPID_4, BLITZ, ASYNC } from "../types";
import { BulletClock } from "./move/bullet";
import { Rapid2Clock } from "./move/rapid_2";
import { Rapid3Clock } from "./move/rapid_3";
import { Rapid4Clock } from "./move/rapid_4";
import { BlitzClock }  from "./move/blitz";
import { AsyncClock }  from "./move/async";

export function createClock(format?: ClockFormat): Clock {
    switch (format) {
        case BULLET:  return new BulletClock();
        case RAPID_2: return new Rapid2Clock();
        case RAPID_3: return new Rapid3Clock();
        case RAPID_4: return new Rapid4Clock();
        case BLITZ:   return new BlitzClock();
        case ASYNC:   return new AsyncClock();
        default:      return new BlitzClock();
    }
}
