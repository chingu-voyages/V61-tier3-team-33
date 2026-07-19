import { describe, expect, test } from "bun:test";

import type { Move } from "../core/move";
import { PieceColor } from "../core/piece";
import { TurnContext } from "../core/state";
import { getDefaultParser } from "../parser/default";
import { getDefaultEngine } from "./default";
import type { IEngine } from "./engine";

describe("Engine", () => {
  describe("perft", () => {
    const engine = getDefaultEngine();
    const parser = getDefaultParser();

    function perft(engine: IEngine, ctx: TurnContext, depth: number): number {
      const moves: Move[] = engine.getAllLegalMoves([], ctx);

      if (depth === 1) {
        return moves.length;
      }

      let nodes = 0;
      for (const move of moves) {
        const snap = engine.apply(ctx, move);
        ctx.sideToMove = PieceColor.opponent(ctx.sideToMove);
        nodes += perft(engine, ctx, depth - 1);
        ctx.sideToMove = PieceColor.opponent(ctx.sideToMove);
        engine.undo(ctx, snap);
      }
      return nodes;
    }

    function assertPerft(fen: string, depth: number, want: number) {
      const ctx = TurnContext.create();
      const err = parser.decode(fen, ctx);
      expect(err).toBeNull();
      const got = perft(engine, ctx, depth);
      expect(got).toBe(want);
    }

    test("position 1 (start) depth 1", () =>
      assertPerft("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 1, 20));
    test("position 1 (start) depth 2", () =>
      assertPerft("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 2, 400));
    test("position 1 (start) depth 3", () =>
      assertPerft("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 3, 8902));
    test("position 1 (start) depth 4", () =>
      assertPerft("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 4, 197281));

    test("position 2 (Kiwipete) depth 1", () =>
      assertPerft("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 1, 48));
    test("position 2 (Kiwipete) depth 2", () =>
      assertPerft("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 2, 2039));
    test("position 2 (Kiwipete) depth 3", () =>
      assertPerft("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 3, 97862));

    test("position 3 (en passant edge cases) depth 1", () =>
      assertPerft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 1, 14));
    test("position 3 (en passant edge cases) depth 2", () =>
      assertPerft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 2, 191));
    test("position 3 (en passant edge cases) depth 3", () =>
      assertPerft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 3, 2812));
    test("position 3 (en passant edge cases) depth 4", () =>
      assertPerft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 4, 43238));

    test("position 4 (promotion and pins) depth 1", () =>
      assertPerft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 1, 6));
    test("position 4 (promotion and pins) depth 2", () =>
      assertPerft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 2, 264));
    test("position 4 (promotion and pins) depth 3", () =>
      assertPerft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 3, 9467));
    test("position 4 (promotion and pins) depth 4", () =>
      assertPerft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 4, 422333));

    test("position 5 (promotion-captures) depth 1", () =>
      assertPerft("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", 1, 44));
    test("position 5 (promotion-captures) depth 2", () =>
      assertPerft("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", 2, 1486));
    test("position 5 (promotion-captures) depth 3", () =>
      assertPerft("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", 3, 62379));

    test("position 6 (complex middlegame) depth 1", () =>
      assertPerft("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", 1, 46));
    test("position 6 (complex middlegame) depth 2", () =>
      assertPerft("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", 2, 2079));
    test("position 6 (complex middlegame) depth 3", () =>
      assertPerft("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", 3, 89890));
  });
});
