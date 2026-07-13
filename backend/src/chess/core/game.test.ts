import { describe, expect, test } from "bun:test";

import {
  CHECKMATE,
  DRAW,
  DrawReason,
  FIFTY_MOVE_RULE,
  GameStatus,
  IN_PROGRESS,
  INSUFFICIENT_MATERIAL,
  NO_DRAW_REASON,
  STALEMATE,
  THREEFOLD_REPETITION,
} from "./game";
import { BLACK, WHITE } from "./piece";

describe("GameStatus", () => {
  test("IN_PROGRESS → 0", () => expect(IN_PROGRESS).toBe(GameStatus(0)));
  test("CHECKMATE → 1", () => expect(CHECKMATE).toBe(GameStatus(1)));
  test("DRAW → 2", () => expect(DRAW).toBe(GameStatus(2)));

  test("constants are pairwise distinct", () => {
    expect(IN_PROGRESS).not.toBe(CHECKMATE);
    expect(IN_PROGRESS).not.toBe(DRAW);
    expect(CHECKMATE).not.toBe(DRAW);
  });

  test("GameStatus(value) preserves the numeric value", () => {
    expect(GameStatus(0)).toBe(IN_PROGRESS);
    expect(GameStatus(1)).toBe(CHECKMATE);
    expect(GameStatus(2)).toBe(DRAW);
  });

  test("all three statuses are covered by the constants", () => {
    const all = [IN_PROGRESS, CHECKMATE, DRAW];
    const distinct = new Set(all as readonly number[]);
    expect(distinct.size).toBe(3);
  });
});

describe("DrawReason", () => {
  test("NO_DRAW_REASON → 0", () => expect(NO_DRAW_REASON).toBe(DrawReason(0)));
  test("STALEMATE → 1", () => expect(STALEMATE).toBe(DrawReason(1)));
  test("THREEFOLD_REPETITION → 2", () => expect(THREEFOLD_REPETITION).toBe(DrawReason(2)));
  test("FIFTY_MOVE_RULE → 3", () => expect(FIFTY_MOVE_RULE).toBe(DrawReason(3)));
  test("INSUFFICIENT_MATERIAL → 4", () => expect(INSUFFICIENT_MATERIAL).toBe(DrawReason(4)));

  test("constants are pairwise distinct", () => {
    const all = [NO_DRAW_REASON, STALEMATE, THREEFOLD_REPETITION, FIFTY_MOVE_RULE, INSUFFICIENT_MATERIAL];
    const distinct = new Set(all as readonly number[]);
    expect(distinct.size).toBe(all.length);
  });

  test("DrawReason(value) preserves the numeric value", () => {
    expect(DrawReason(0)).toBe(NO_DRAW_REASON);
    expect(DrawReason(1)).toBe(STALEMATE);
    expect(DrawReason(2)).toBe(THREEFOLD_REPETITION);
    expect(DrawReason(3)).toBe(FIFTY_MOVE_RULE);
    expect(DrawReason(4)).toBe(INSUFFICIENT_MATERIAL);
  });

  test("NO_DRAW_REASON is the zero sentinel", () => {
    expect(NO_DRAW_REASON).toBe(DrawReason(0));
  });
});

describe("GameResult", () => {
  test("in-progress result has no winner and no draw reason", () => {
    const result = {
      status: IN_PROGRESS,
      winner: WHITE,
      hasWinner: false,
      drawReason: NO_DRAW_REASON,
    };
    expect(result.status).toBe(IN_PROGRESS);
    expect(result.hasWinner).toBe(false);
    expect(result.drawReason).toBe(NO_DRAW_REASON);
  });

  test("checkmate result has a winner and no draw reason", () => {
    const result = {
      status: CHECKMATE,
      winner: WHITE,
      hasWinner: true,
      drawReason: NO_DRAW_REASON,
    };
    expect(result.status).toBe(CHECKMATE);
    expect(result.winner).toBe(WHITE);
    expect(result.hasWinner).toBe(true);
    expect(result.drawReason).toBe(NO_DRAW_REASON);
  });

  test("checkmate winner can be either color", () => {
    const whiteWins = {
      status: CHECKMATE,
      winner: WHITE,
      hasWinner: true,
      drawReason: NO_DRAW_REASON,
    };
    const blackWins = {
      status: CHECKMATE,
      winner: BLACK,
      hasWinner: true,
      drawReason: NO_DRAW_REASON,
    };
    expect(whiteWins.winner).toBe(WHITE);
    expect(blackWins.winner).toBe(BLACK);
    expect(whiteWins.winner).not.toBe(blackWins.winner);
  });

  test("draw result has no winner and a non-zero draw reason", () => {
    const reasons = [STALEMATE, THREEFOLD_REPETITION, FIFTY_MOVE_RULE, INSUFFICIENT_MATERIAL];
    for (const reason of reasons) {
      const result = {
        status: DRAW,
        winner: WHITE,
        hasWinner: false,
        drawReason: reason,
      };
      expect(result.status).toBe(DRAW);
      expect(result.hasWinner).toBe(false);
      expect(result.drawReason).toBe(reason);
      expect(result.drawReason).not.toBe(NO_DRAW_REASON);
    }
  });
});
