import type { ITracker } from "./tracker";
import { PositionTracker } from "./position";

const defaultTracker = new PositionTracker();

export function getDefaultTracker(): ITracker {
  return defaultTracker;
}