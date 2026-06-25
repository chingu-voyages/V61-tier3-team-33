import type { ITracker } from "./tracker";
import { PositionTracker } from "./position_tracker";

export function getDefaultTracker(): ITracker {
  return new PositionTracker();
}
