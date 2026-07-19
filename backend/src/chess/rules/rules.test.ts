import { describe, expect, test } from "bun:test";

import {
  CHECKMATE,
  DRAW,
  FIFTY_MOVE_RULE,
  IN_PROGRESS,
  INSUFFICIENT_MATERIAL,
  STALEMATE,
  THREEFOLD_REPETITION,
} from "../core/game";
import { BLACK } from "../core/piece";
import type { TurnContext } from "../core/state";
import { getDefaultEngine } from "../engine/default";
import { getDefaultParser } from "../parser/default";
import { getDefaultTracker } from "../tracker/default";
import { getDefaultRules } from "./default";

describe("Rules", () => {
  const rules = getDefaultRules();
  const engine = getDefaultEngine();
  const parser = getDefaultParser();

  function decode(fen: string): TurnContext {
    const [ctx, err] = parser.decode(fen);
    expect(err).toBeNull();
    return ctx!;
  }

  describe("isFiftyMoveRule", () => {
    test("halfmove clock below 100 returns false", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      expect(rules.isFiftyMoveRule(ctx)).toBe(false);
    });

    test("halfmove clock at 99 returns false", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 99 50");
      expect(rules.isFiftyMoveRule(ctx)).toBe(false);
    });

    test("halfmove clock at 100 returns true", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 100 50");
      expect(rules.isFiftyMoveRule(ctx)).toBe(true);
    });

    test("halfmove clock above 100 returns true", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 150 75");
      expect(rules.isFiftyMoveRule(ctx)).toBe(true);
    });
  });

  describe("isThreefoldRepetition", () => {
    test("count below 3 returns false", () => {
      const tracker = getDefaultTracker();
      tracker.record(42n);
      tracker.record(42n);
      expect(rules.isThreefoldRepetition(tracker, 42n)).toBe(false);
    });

    test("count at 3 returns true", () => {
      const tracker = getDefaultTracker();
      tracker.record(42n);
      tracker.record(42n);
      tracker.record(42n);
      expect(rules.isThreefoldRepetition(tracker, 42n)).toBe(true);
    });

    test("count above 3 returns true", () => {
      const tracker = getDefaultTracker();
      for (let i = 0; i < 5; i++) tracker.record(42n);
      expect(rules.isThreefoldRepetition(tracker, 42n)).toBe(true);
    });

    test("a hash that was never recorded returns false", () => {
      const tracker = getDefaultTracker();
      tracker.record(42n);
      expect(rules.isThreefoldRepetition(tracker, 99n)).toBe(false);
    });
  });

  describe("isInsufficientMaterial", () => {
    test("K vs K returns true", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(true);
    });

    test("K+N vs K returns true", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/3NK3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(true);
    });

    test("K+B vs K returns true", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/3BK3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(true);
    });

    test("K+B vs K+B same square color returns true", () => {
      const ctx = decode("5b2/8/8/8/8/8/8/2B1K2k w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(true);
    });

    test("K+B vs K+B opposite square colors returns false", () => {
      const ctx = decode("2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(false);
    });

    test("K+N+N vs K returns false (not classified as insufficient)", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/2NNK3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(false);
    });

    test("K+P vs K returns false", () => {
      const ctx = decode("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(false);
    });

    test("K+Q vs K returns false", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/3QK3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(false);
    });

    test("K+R vs K returns false", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/3RK3 w - - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(false);
    });

    test("starting position returns false", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      expect(rules.isInsufficientMaterial(ctx)).toBe(false);
    });
  });

  describe("isCheckMate", () => {
    test("fool's mate position returns true", () => {
      const ctx = decode("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
      expect(rules.isCheckMate(ctx, engine)).toBe(true);
    });

    test("starting position returns false", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      expect(rules.isCheckMate(ctx, engine)).toBe(false);
    });

    test("a stalemated position returns false (not in check)", () => {
      const ctx = decode("k7/2Q5/2K5/8/8/8/8/8 b - - 0 1");
      expect(rules.isCheckMate(ctx, engine)).toBe(false);
    });
  });

  describe("isStaleMate", () => {
    test("a stalemated position returns true", () => {
      const ctx = decode("k7/2Q5/2K5/8/8/8/8/8 b - - 0 1");
      expect(rules.isStaleMate(ctx, engine)).toBe(true);
    });

    test("starting position returns false", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      expect(rules.isStaleMate(ctx, engine)).toBe(false);
    });

    test("a checkmated position returns false (in check)", () => {
      const ctx = decode("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
      expect(rules.isStaleMate(ctx, engine)).toBe(false);
    });
  });

  describe("getGameResult", () => {
    test("starting position returns IN_PROGRESS", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const tracker = getDefaultTracker();
      const result = rules.getGameResult(ctx, engine, tracker, 0n);
      expect(result.status).toBe(IN_PROGRESS);
    });

    test("fifty-move rule returns DRAW with FIFTY_MOVE_RULE reason", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/4K3 w - - 100 50");
      const tracker = getDefaultTracker();
      const result = rules.getGameResult(ctx, engine, tracker, 0n);
      expect(result.status).toBe(DRAW);
      expect(result.drawReason).toBe(FIFTY_MOVE_RULE);
    });

    test("threefold repetition returns DRAW with THREEFOLD_REPETITION reason", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
      const tracker = getDefaultTracker();
      tracker.record(42n);
      tracker.record(42n);
      tracker.record(42n);
      const result = rules.getGameResult(ctx, engine, tracker, 42n);
      expect(result.status).toBe(DRAW);
      expect(result.drawReason).toBe(THREEFOLD_REPETITION);
    });

    test("insufficient material returns DRAW with INSUFFICIENT_MATERIAL reason", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
      const tracker = getDefaultTracker();
      const result = rules.getGameResult(ctx, engine, tracker, 0n);
      expect(result.status).toBe(DRAW);
      expect(result.drawReason).toBe(INSUFFICIENT_MATERIAL);
    });

    test("checkmate returns CHECKMATE with the winner set", () => {
      const ctx = decode("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
      const tracker = getDefaultTracker();
      const result = rules.getGameResult(ctx, engine, tracker, 0n);
      expect(result.status).toBe(CHECKMATE);
      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe(BLACK);
    });

    test("stalemate returns DRAW with STALEMATE reason", () => {
      const ctx = decode("k7/2Q5/2K5/8/8/8/8/8 b - - 0 1");
      const tracker = getDefaultTracker();
      const result = rules.getGameResult(ctx, engine, tracker, 0n);
      expect(result.status).toBe(DRAW);
      expect(result.drawReason).toBe(STALEMATE);
    });

    test("fifty-move rule takes priority over checkmate", () => {
      const ctx = decode("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 100 50");
      const tracker = getDefaultTracker();
      const result = rules.getGameResult(ctx, engine, tracker, 0n);
      expect(result.drawReason).toBe(FIFTY_MOVE_RULE);
    });
  });
});
