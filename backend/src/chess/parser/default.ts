import { FEN } from "./fen";
import type { IParser } from "./parser";

const defaultParser = new FEN();

/** Returns the default singleton FEN parser. */
export function getDefaultParser(): IParser {
  return defaultParser;
}
