import type { Move } from "../core/move";
import type { BoardContext, MoveContext } from "../core/state";

import { Knight } from "./knight";
import { NORMAL } from "../core/move";
import { SideState } from "../core/state";
import { Board, Square } from "../core/board";
import { describe, expect, test } from "bun:test";
import type { Piece } from "../core/piece";
import {
  KNIGHT,
  PAWN,
  ROOK,
  QUEEN,
  BISHOP,
  KING,
  WHITE,
  BLACK,
} from "../core/piece";
import {
  Position,
  NO_POSITION,
  A1,
  A4,
  A8,
  B2,
  B3,
  B5,
  B6,
  B7,
  C2,
  C3,
  C4,
  C5,
  C6,
  C7,
  D1,
  D2,
  D3,
  D4,
  D6,
  D8,
  E2,
  E3,
  E4,
  E6,
  F2,
  F3,
  F5,
  F6,
  F7,
  G2,
  G3,
  G5,
  G6,
  H1,
  H4,
  H7,
  H8,
} from "../core/position";

describe("Knight", () => {
  const knight = new Knight();

  function boardCtx(init: (b: Board) => void): BoardContext {
    const board = Board.create();
    init(board);
    return { board };
  }

  function moveCtx(
    init: (b: Board) => void,
    side: typeof WHITE | typeof BLACK,
  ): MoveContext {
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
    test("a white knight on any of the 8 L-shape squares around E4 attacks E4", () => {
      for (const from of [C3, C5, D2, D6, F2, F6, G3, G5] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: KNIGHT, color: WHITE })),
        );
        expect(knight.isAttacking(WHITE, E4, c)).toBe(true);
      }
    });

    test("a knight on a non-L-shape square does not attack E4", () => {
      for (const from of [D3, E6, H4, G6, H7] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: KNIGHT, color: WHITE })),
        );
        expect(knight.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("a knight of the wrong color is ignored", () => {
      const c = boardCtx((b) =>
        Board.place(b, D6, Square.create({ type: KNIGHT, color: BLACK })),
      );
      expect(knight.isAttacking(WHITE, E4, c)).toBe(false);
      expect(knight.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a non-knight piece on an L-shape square does not trigger a knight attack", () => {
      for (const pt of [QUEEN, ROOK, BISHOP, KING, PAWN] as const) {
        const c = boardCtx((b) =>
          Board.place(b, D6, Square.create({ type: pt, color: WHITE })),
        );
        expect(knight.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("an empty board reports no attack", () => {
      const c = boardCtx(() => {});
      expect(knight.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a knight sitting on the target square itself does not attack it", () => {
      const c = boardCtx((b) =>
        Board.place(b, E4, Square.create({ type: KNIGHT, color: WHITE })),
      );
      expect(knight.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("corner A1 is attacked from B3 and C2 only", () => {
      for (const from of [B3, C2] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: KNIGHT, color: WHITE })),
        );
        expect(knight.isAttacking(WHITE, A1, c)).toBe(true);
      }
      const c = boardCtx((b) =>
        Board.place(b, H8, Square.create({ type: KNIGHT, color: WHITE })),
      );
      expect(knight.isAttacking(WHITE, A1, c)).toBe(false);
    });

    test("corner H8 is attacked from F7 and G6", () => {
      for (const from of [F7, G6] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: KNIGHT, color: WHITE })),
        );
        expect(knight.isAttacking(WHITE, H8, c)).toBe(true);
      }
    });

    test("corner A8 is attacked from B6", () => {
      const c = boardCtx((b) =>
        Board.place(b, B6, Square.create({ type: KNIGHT, color: WHITE })),
      );
      expect(knight.isAttacking(WHITE, A8, c)).toBe(true);
    });

    test("corner H1 is attacked from F2", () => {
      const c = boardCtx((b) =>
        Board.place(b, F2, Square.create({ type: KNIGHT, color: WHITE })),
      );
      expect(knight.isAttacking(WHITE, H1, c)).toBe(true);
    });

    test("edge target A4 is attacked from its 4 L-shape squares", () => {
      for (const from of [B6, C5, B2, C3] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: KNIGHT, color: WHITE })),
        );
        expect(knight.isAttacking(WHITE, A4, c)).toBe(true);
      }
    });

    test("among multiple knights, any matching-color knight on an L-shape attacks", () => {
      const c = boardCtx((b) => {
        Board.place(b, A1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(b, D6, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(b, H8, Square.create({ type: KNIGHT, color: WHITE }));
      });
      expect(knight.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("multiple enemy knights do not count as attackers for us", () => {
      const c = boardCtx((b) => {
        Board.place(b, D6, Square.create({ type: KNIGHT, color: BLACK }));
        Board.place(b, F6, Square.create({ type: KNIGHT, color: BLACK }));
      });
      expect(knight.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("mixed-color knights: only the matching color counts", () => {
      const c = boardCtx((b) => {
        Board.place(b, D6, Square.create({ type: KNIGHT, color: BLACK }));
        Board.place(b, F6, Square.create({ type: KNIGHT, color: WHITE }));
      });
      expect(knight.isAttacking(WHITE, E4, c)).toBe(true);
    });
  });

  describe("attacks", () => {
    test("knight on center D4 threatens all 8 L-shape squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], D4, c)).toEqual([
        E6,
        E2,
        C6,
        C2,
        F5,
        F3,
        B5,
        B3,
      ]);
    });

    test("knight on corner A1 threatens 2 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], A1, c)).toEqual([B3, C2]);
    });

    test("knight on corner H1 threatens 2 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], H1, c)).toEqual([G3, F2]);
    });

    test("knight on corner A8 threatens 2 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], A8, c)).toEqual([B6, C7]);
    });

    test("knight on corner H8 threatens 2 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], H8, c)).toEqual([G6, F7]);
    });

    test("knight on edge A4 threatens 4 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], A4, c)).toEqual([B6, B2, C5, C3]);
    });

    test("knight on edge H4 threatens 4 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], H4, c)).toEqual([G6, G2, F5, F3]);
    });

    test("knight on edge D1 threatens 4 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], D1, c)).toEqual([E3, C3, F2, B2]);
    });

    test("knight on edge D8 threatens 4 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], D8, c)).toEqual([E6, C6, F7, B7]);
    });

    test("knight on near-corner B2 threatens 4 squares", () => {
      const c = boardCtx(() => {});
      expect(knight.attacks([], B2, c)).toEqual([C4, A4, D3, D1]);
    });
  });

  describe("pseudoLegalMoves", () => {
    function dests(moves: Move[]): Position[] {
      return moves.map((m) => m.to);
    }

    const d4Attacks: Position[] = [E6, E2, C6, C2, F5, F3, B5, B3];

    test("knight on center D4 with an empty board has 8 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = knight.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual(d4Attacks);
      expect(moves).toHaveLength(8);
    });

    test("knight on corner A1 with an empty board has 2 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      expect(dests(knight.pseudoLegalMoves([], A1, c))).toEqual([B3, C2]);
    });

    test("knight on corner H8 with an empty board has 2 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      expect(dests(knight.pseudoLegalMoves([], H8, c))).toEqual([G6, F7]);
    });

    test("knight on edge A4 with an empty board has 4 moves", () => {
      const c = moveCtx(() => {}, WHITE);
      expect(dests(knight.pseudoLegalMoves([], A4, c))).toEqual([
        B6,
        B2,
        C5,
        C3,
      ]);
    });

    test("a square occupied by a friendly piece is excluded from the move list", () => {
      const c = moveCtx(
        (b) =>
          Board.place(b, E6, Square.create({ type: KNIGHT, color: WHITE })),
        WHITE,
      );
      const moves = knight.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([E2, C6, C2, F5, F3, B5, B3]);
    });

    test("a square occupied by an enemy piece is included as a capture", () => {
      const c = moveCtx(
        (b) =>
          Board.place(b, E6, Square.create({ type: KNIGHT, color: BLACK })),
        WHITE,
      );
      const moves = knight.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual(d4Attacks);

      const capture = moves.find((m) => m.to === E6);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: KNIGHT, color: BLACK });
    });

    test("captures carry the exact enemy piece sitting on the destination", () => {
      const c = moveCtx((b) => {
        Board.place(b, E6, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(b, F5, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, C2, Square.create({ type: BISHOP, color: BLACK }));
      }, WHITE);

      const moves = knight.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual(d4Attacks);

      const wantCaptures: Record<number, Piece> = {
        [E6]: { type: QUEEN, color: BLACK },
        [F5]: { type: ROOK, color: BLACK },
        [C2]: { type: BISHOP, color: BLACK },
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

    test("a mix of friendly and enemy blockers excludes own, includes enemy", () => {
      const c = moveCtx((b) => {
        Board.place(b, E6, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(b, C6, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(b, F5, Square.create({ type: KNIGHT, color: BLACK }));
      }, WHITE);

      const moves = knight.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([E2, C2, F5, F3, B5, B3]);
    });

    test("all 8 squares blocked by friendly pieces yields no moves", () => {
      const c = moveCtx((b) => {
        for (const pos of d4Attacks) {
          Board.place(b, pos, Square.create({ type: KNIGHT, color: WHITE }));
        }
      }, WHITE);

      const moves = knight.pseudoLegalMoves([], D4, c);
      expect(moves).toHaveLength(0);
    });

    test("a black knight treats white pieces as enemies (captures) and black as own", () => {
      const c = moveCtx(
        (b) =>
          Board.place(b, E6, Square.create({ type: KNIGHT, color: WHITE })),
        BLACK,
      );
      const moves = knight.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual(d4Attacks);

      const capture = moves.find((m) => m.to === E6);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: KNIGHT, color: WHITE });
    });

    test("a black knight treats black pieces as own (excluded)", () => {
      const c = moveCtx(
        (b) =>
          Board.place(b, E6, Square.create({ type: KNIGHT, color: BLACK })),
        BLACK,
      );
      const moves = knight.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([E2, C6, C2, F5, F3, B5, B3]);
    });

    test("every generated move has type NORMAL and carries the mover and source square", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = knight.pseudoLegalMoves([], D4, c);

      for (const m of moves) {
        expect(m.type).toBe(NORMAL);
        expect(m.piece).toEqual({ type: KNIGHT, color: WHITE });
        expect(m.from).toBe(D4);
      }
    });
  });
});
