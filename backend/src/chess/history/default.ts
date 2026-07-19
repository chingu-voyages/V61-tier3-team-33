import type { IHistory } from "./history";
import { MemoryHistory } from "./memory";

export function getDefaultHistory(): IHistory {
  return new MemoryHistory();
}
