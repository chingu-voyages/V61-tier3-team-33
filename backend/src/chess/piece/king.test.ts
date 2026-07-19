import { describe, expect, test } from "bun:test";

import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { NORMAL } from "../core/move";
import type { Piece } from "../core/piece";
import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import type { Position } from "../core/position";
import {
  A1,
  A2,
  A3,
  A4,
  A5,
  A7,
  A8,
  B1,
  B2,
  B3,
  B4,
  B5,
  B7,
  B8,
  C1,
  C2,
  C3,
  C4,
  C5,
  D1,
  D2,
  D3,
  D4,
  D5,
  E1,
  E2,
  E3,
  E4,
  E5,
  E6,
  F3,
  F4,
  F5,
  G1,
  G2,
  G6,
  G7,
  G8,
  H1,
  H2,
  H7,
  H8,
  NO_POSITION,
} from "../core/position";
import type { BoardContext, MoveContext } from "../core/state";
import { SideState } from "../core/state";
import { King } from "./king";

describe("King", () => {
  const king = new King();

  function boardCtx(init: (b: Board) => void): BoardContext {
    const board = Board.create();
    init(board);
    return { board };
  }

  function moveCtx(init: (b: Board) => void, side: typeof WHITE | typeof BLACK): MoveContext {
    const board = Board.create();
    init(board);
    return {
      board,
      sideToMove: side,
      sides: [SideState.empty(), SideState.empty()],
      enPassantTarget: NO_POSITION,
    };
  }

  describe("isAttacking", () => {
    test("a white king on any of the eight squares adjacent to E4 attacks E4", () => {
      for (const from of [D3, D4, D5, E3, E5, F3, F4, F5] as const) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: KING, color: WHITE })));
        expect(king.isAttacking(WHITE, E4, c)).toBe(true);
      }
    });

    test("a king two squares away does not attack (kings don't slide)", () => {
      for (const from of [E6, C4, G6] as const) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: KING, color: WHITE })));
        expect(king.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("a king of the wrong color is ignored", () => {
      const c = boardCtx((b) => Board.place(b, D4, Square.create({ type: KING, color: BLACK })));
      expect(king.isAttacking(WHITE, E4, c)).toBe(false);
      expect(king.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a non-king piece on an adjacent square does not trigger a king attack", () => {
      for (const pt of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN] as const) {
        const c = boardCtx((b) => Board.place(b, D4, Square.create({ type: pt, color: WHITE })));
        expect(king.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("an empty board reports no attack", () => {
      const c = boardCtx(() => {});
      expect(king.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a king sitting on the target square itself does not attack it", () => {
      const c = boardCtx((b) => Board.place(b, E4, Square.create({ type: KING, color: WHITE })));
      expect(king.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a corner target is attacked from its 3 adjacent squares only", () => {
      for (const from of [A2, B1, B2] as const) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: KING, color: WHITE })));
        expect(king.isAttacking(WHITE, A1, c)).toBe(true);
      }
      const c = boardCtx((b) => Board.place(b, H8, Square.create({ type: KING, color: WHITE })));
      expect(king.isAttacking(WHITE, A1, c)).toBe(false);
    });

    test("an edge target is attacked from its 5 adjacent squares", () => {
      for (const from of [A3, A5, B3, B4, B5] as const) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: KING, color: WHITE })));
        expect(king.isAttacking(WHITE, A4, c)).toBe(true);
      }
    });

    test("among multiple kings, any matching-color king on an adjacent square attacks", () => {
      const c = boardCtx((b) => {
        Board.place(b, A1, Square.create({ type: KING, color: WHITE }));
        Board.place(b, D4, Square.create({ type: KING, color: WHITE }));
        Board.place(b, H8, Square.create({ type: KING, color: WHITE }));
      });
      expect(king.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("mixed-color kings: only the matching color counts", () => {
      const c = boardCtx((b) => {
        Board.place(b, D4, Square.create({ type: KING, color: BLACK }));
        Board.place(b, E5, Square.create({ type: KING, color: WHITE }));
      });
      expect(king.isAttacking(WHITE, E4, c)).toBe(true);
    });
  });

  describe("attacks", () => {
    test("king on center D4 threatens all 8 adjacent squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], D4, c)).toEqual([D5, D3, C4, E4, E5, E3, C5, C3]);
    });

    test("king on corner A1 threatens 3 squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], A1, c)).toEqual([A2, B1, B2]);
    });

    test("king on corner H1 threatens 3 squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], H1, c)).toEqual([H2, G1, G2]);
    });

    test("king on corner A8 threatens 3 squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], A8, c)).toEqual([A7, B8, B7]);
    });

    test("king on corner H8 threatens 3 squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], H8, c)).toEqual([H7, G8, G7]);
    });

    test("king on edge A4 threatens 5 squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], A4, c)).toEqual([A5, A3, B4, B5, B3]);
    });

    test("king on edge D1 threatens 5 squares", () => {
      const c = boardCtx(() => {});
      expect(king.attacks([], D1, c)).toEqual([D2, C1, E1, E2, C2]);
    });

    test("king attacks adjacent squares even when they are occupied", () => {
      const c = boardCtx((b) => {
        Board.place(b, C3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D3, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, E3, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E4, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, E5, Square.create({ type: QUEEN, color: BLACK }));
      });
      expect(king.attacks([], D4, c)).toEqual([D5, D3, C4, E4, E5, E3, C5, C3]);
    });
  });

  describe("pseudoLegalMoves", () => {
    function dests(moves: Move[]): Position[] {
      return moves.map((m) => m.to);
    }

    const d4Adjacent: Position[] = [D5, D3, C4, E4, E5, E3, C5, C3];

    test("king on center D4 with an empty board has 8 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = king.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual(d4Adjacent);
      expect(moves).toHaveLength(8);
    });

    test("a square occupied by a friendly piece is excluded from the move list", () => {
      const c = moveCtx((b) => Board.place(b, D5, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = king.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([D3, C4, E4, E5, E3, C5, C3]);
    });

    test("a square occupied by an enemy piece is included as a capture", () => {
      const c = moveCtx((b) => Board.place(b, D5, Square.create({ type: PAWN, color: BLACK })), WHITE);
      const moves = king.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual(d4Adjacent);

      const capture = moves.find((m) => m.to === D5);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: BLACK });
    });

    test("captures carry the exact enemy piece type and color sitting on the destination", () => {
      const c = moveCtx((b) => {
        Board.place(b, D5, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(b, E4, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, C3, Square.create({ type: KNIGHT, color: BLACK }));
      }, WHITE);

      const moves = king.pseudoLegalMoves([], D4, c);

      const wantCaptures: Record<number, Piece> = {
        [D5]: { type: QUEEN, color: BLACK },
        [E4]: { type: ROOK, color: BLACK },
        [C3]: { type: KNIGHT, color: BLACK },
      };

      for (const m of moves) {
        const want = wantCaptures[m.to];
        if (want) {
          expect(m.captured).toEqual(want);
        } else {
          expect(m.captured).toBeNull();
        }
      }
    });

    test("a mix of friendly and enemy on adjacent squares excludes own, includes enemy", () => {
      const c = moveCtx((b) => {
        Board.place(b, D5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E4, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, C3, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);

      const moves = king.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([D3, E4, E5, E3, C5, C3]);
    });

    test("all 8 adjacent squares blocked by own pieces yields no moves", () => {
      const c = moveCtx((b) => {
        for (const pos of d4Adjacent) {
          Board.place(b, pos, Square.create({ type: PAWN, color: WHITE }));
        }
      }, WHITE);

      const moves = king.pseudoLegalMoves([], D4, c);
      expect(moves).toHaveLength(0);
    });

    test("king on corner A1 with an empty board has 3 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      expect(dests(king.pseudoLegalMoves([], A1, c))).toEqual([A2, B1, B2]);
    });

    test("king on edge A4 with an empty board has 5 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      expect(dests(king.pseudoLegalMoves([], A4, c))).toEqual([A5, A3, B4, B5, B3]);
    });

    test("a black king treats white pieces as enemies (captures) and black as own", () => {
      const c = moveCtx((b) => {
        Board.place(b, D5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C4, Square.create({ type: PAWN, color: BLACK }));
      }, BLACK);

      const moves = king.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([D5, D3, E4, E5, E3, C5, C3]);

      const capture = moves.find((m) => m.to === D5);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: WHITE });
    });

    test("every generated move has type NORMAL and carries the mover and source square (no castling)", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = king.pseudoLegalMoves([], D4, c);

      for (const m of moves) {
        expect(m.type).toBe(NORMAL);
        expect(m.piece).toEqual({ type: KING, color: WHITE });
        expect(m.from).toBe(D4);
      }
    });
  });
});
