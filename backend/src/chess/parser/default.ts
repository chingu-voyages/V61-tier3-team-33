import type { IParser } from "./parser";

import { FEN } from "./fen";

const defaultParser = new FEN();

/** Returns the default singleton FEN parser. */
export function getDefaultParser(): IParser {
  return defaultParser;
}
