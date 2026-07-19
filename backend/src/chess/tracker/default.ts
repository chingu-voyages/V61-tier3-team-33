import { PositionTracker } from "./position_tracker";
import type { ITracker } from "./tracker";

export function getDefaultTracker(): ITracker {
  return new PositionTracker();
}
