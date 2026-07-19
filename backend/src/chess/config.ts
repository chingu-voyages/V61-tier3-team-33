import { getDefaultEngine } from "./engine/default";
import type { IEngine } from "./engine/engine";
import { getDefaultHasher } from "./hasher/default";
import type { IHasher } from "./hasher/hasher";
import { getDefaultHistory } from "./history/default";
import type { IHistory } from "./history/history";
import { getDefaultParser } from "./parser/default";
import type { IParser } from "./parser/parser";
import { getDefaultRules } from "./rules/default";
import type { IRules } from "./rules/rules";
import { getDefaultTracker } from "./tracker/default";
import type { ITracker } from "./tracker/tracker";

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * All fields are optional — omit any to get the default implementation.
 *
 * @example
 * // Standard game
 * const game = new Chess();
 *
 * // Custom position
 * const game = new Chess({ fen: "r3k2r/..." });
 *
 * // Plug in a persistent history store
 * const game = new Chess({ history: new RedisHistory() });
 */
export interface ChessConfig {
  fen?: string;
  engine?: IEngine;
  hasher?: IHasher;
  rules?: IRules;
  parser?: IParser;
  tracker?: ITracker;
  history?: IHistory;
}

export function resolveConfig(config: ChessConfig = {}): Required<ChessConfig> {
  return {
    fen: config.fen ?? STARTING_FEN,
    engine: config.engine ?? getDefaultEngine(),
    hasher: config.hasher ?? getDefaultHasher(),
    rules: config.rules ?? getDefaultRules(),
    parser: config.parser ?? getDefaultParser(),
    tracker: config.tracker ?? getDefaultTracker(),
    history: config.history ?? getDefaultHistory(),
  };
}
