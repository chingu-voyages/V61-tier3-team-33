import { describe, expect, test } from "bun:test";

import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { EN_PASSANT, NORMAL, PROMOTION } from "../core/move";
import type { Piece } from "../core/piece";
import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import type { Position } from "../core/position";
import {
  A4,
  A5,
  B3,
  B5,
  D1,
  D2,
  D3,
  D4,
  D5,
  D6,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E6,
  E7,
  E8,
  F3,
  F5,
  F6,
  F8,
  G3,
  G5,
  H4,
  H5,
  NO_POSITION,
} from "../core/position";
import type { MoveContext } from "../core/state";
import { SideState } from "../core/state";
import { Pawn } from "./pawn";

describe("Pawn", () => {
  const pawn = new Pawn();

  function moveCtx(
    init: (b: Board) => void,
    side: typeof WHITE | typeof BLACK,
    epTarget: Position = NO_POSITION,
  ): MoveContext {
    const board = Board.create();
    init(board);
    return {
      board,
      sideToMove: side,
      sides: [SideState.empty(), SideState.empty()],
      enPassantTarget: epTarget,
    };
  }

  describe("isAttacking", () => {
    function boardCtx(init: (b: Board) => void) {
      const board = Board.create();
      init(board);
      return { board };
    }

    test("a white pawn attacks E4 from down-left (D3)", () => {
      const c = boardCtx((b) => Board.place(b, D3, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a white pawn attacks E4 from down-right (F3)", () => {
      const c = boardCtx((b) => Board.place(b, F3, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a black pawn attacks E4 from up-left (D5)", () => {
      const c = boardCtx((b) => Board.place(b, D5, Square.create({ type: PAWN, color: BLACK })));
      expect(pawn.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a black pawn attacks E4 from up-right (F5)", () => {
      const c = boardCtx((b) => Board.place(b, F5, Square.create({ type: PAWN, color: BLACK })));
      expect(pawn.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a pawn on the same file does not attack (pawns attack diagonally only)", () => {
      const c = boardCtx((b) => Board.place(b, E3, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a pawn of the wrong color is ignored", () => {
      const c = boardCtx((b) => Board.place(b, D5, Square.create({ type: PAWN, color: BLACK })));
      expect(pawn.isAttacking(WHITE, E4, c)).toBe(false);
      expect(pawn.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a non-pawn piece on the attack diagonal does not trigger a pawn attack", () => {
      for (const pt of [QUEEN, ROOK, BISHOP, KNIGHT, KING] as const) {
        const c = boardCtx((b) => Board.place(b, D3, Square.create({ type: pt, color: WHITE })));
        expect(pawn.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("an empty board reports no attack", () => {
      const c = boardCtx(() => {});
      expect(pawn.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a pawn sitting on the target square itself does not attack it", () => {
      const c = boardCtx((b) => Board.place(b, E4, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a pawn on the A file attacks only to the right", () => {
      const c = boardCtx((b) => Board.place(b, B3, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, A4, c)).toBe(true);
    });

    test("a pawn on the H file attacks only to the left", () => {
      const c = boardCtx((b) => Board.place(b, G3, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, H4, c)).toBe(true);
    });

    test("a target on rank 1 is not attacked by any white pawn", () => {
      const c = boardCtx((b) => Board.place(b, D2, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.isAttacking(WHITE, D1, c)).toBe(false);
    });
  });

  describe("attacks", () => {
    function boardCtx(init: (b: Board) => void) {
      const board = Board.create();
      init(board);
      return { board };
    }

    test("a white pawn on E4 threatens D5 and F5", () => {
      const c = boardCtx((b) => Board.place(b, E4, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.attacks([], E4, c)).toEqual([F5, D5]);
    });

    test("a black pawn on E4 threatens D3 and F3", () => {
      const c = boardCtx((b) => Board.place(b, E4, Square.create({ type: PAWN, color: BLACK })));
      expect(pawn.attacks([], E4, c)).toEqual([F3, D3]);
    });

    test("a white pawn on A4 threatens only B5", () => {
      const c = boardCtx((b) => Board.place(b, A4, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.attacks([], A4, c)).toEqual([B5]);
    });

    test("a white pawn on H4 threatens only G5", () => {
      const c = boardCtx((b) => Board.place(b, H4, Square.create({ type: PAWN, color: WHITE })));
      expect(pawn.attacks([], H4, c)).toEqual([G5]);
    });

    test("a black pawn on A4 threatens only B3", () => {
      const c = boardCtx((b) => Board.place(b, A4, Square.create({ type: PAWN, color: BLACK })));
      expect(pawn.attacks([], A4, c)).toEqual([B3]);
    });

    test("a black pawn on H4 threatens only G3", () => {
      const c = boardCtx((b) => Board.place(b, H4, Square.create({ type: PAWN, color: BLACK })));
      expect(pawn.attacks([], H4, c)).toEqual([G3]);
    });

    test("a pawn attacks adjacent squares even when occupied by friendly pieces", () => {
      const c = boardCtx((b) => {
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, F5, Square.create({ type: ROOK, color: WHITE }));
      });
      expect(pawn.attacks([], E4, c)).toEqual([F5, D5]);
    });
  });

  describe("pseudoLegalMoves", () => {
    function dests(moves: Move[]): Position[] {
      return moves.map((m) => m.to);
    }

    test("a white pawn on its start rank with both squares empty can single or double push", () => {
      const c = moveCtx((b) => Board.place(b, E2, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = pawn.pseudoLegalMoves([], E2, c);

      expect(dests(moves)).toEqual([E3, E4]);
      expect(moves).toHaveLength(2);
    });

    test("a black pawn on its start rank with both squares empty can single or double push", () => {
      const c = moveCtx((b) => Board.place(b, E7, Square.create({ type: PAWN, color: BLACK })), BLACK);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      expect(dests(moves)).toEqual([E6, E5]);
      expect(moves).toHaveLength(2);
    });

    test("a pawn not on its start rank can only single push", () => {
      const c = moveCtx((b) => Board.place(b, E3, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = pawn.pseudoLegalMoves([], E3, c);

      expect(dests(moves)).toEqual([E4]);
      expect(moves).toHaveLength(1);
    });

    test("a pawn whose front square is occupied cannot push at all", () => {
      const c = moveCtx((b) => {
        Board.place(b, E2, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E3, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E2, c);

      expect(moves).toHaveLength(0);
    });

    test("a pawn on its start rank whose double-push square is occupied can only single push", () => {
      const c = moveCtx((b) => {
        Board.place(b, E2, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E4, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E2, c);

      expect(dests(moves)).toEqual([E3]);
      expect(moves).toHaveLength(1);
    });

    test("a white pawn captures an enemy on its right diagonal", () => {
      const c = moveCtx((b) => {
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, F5, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E4, c);

      expect(dests(moves)).toEqual([E5, F5]);

      const capture = moves.find((m) => m.to === F5);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: BLACK });
    });

    test("a white pawn captures an enemy on its left diagonal", () => {
      const c = moveCtx((b) => {
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D5, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E4, c);

      expect(dests(moves)).toEqual([E5, D5]);
    });

    test("a white pawn captures enemies on both diagonals", () => {
      const c = moveCtx((b) => {
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, F5, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E4, c);

      expect(dests(moves)).toEqual([E5, F5, D5]);
      expect(moves).toHaveLength(3);
    });

    test("a friendly piece on the diagonal is not capturable", () => {
      const c = moveCtx((b) => {
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, F5, Square.create({ type: PAWN, color: WHITE }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E4, c);

      expect(dests(moves)).toEqual([E5]);
    });

    test("captures carry the exact enemy piece type (not just pawns)", () => {
      const c = moveCtx((b) => {
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D5, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(b, F5, Square.create({ type: ROOK, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E4, c);

      const wantCaptures: Record<number, Piece> = {
        [D5]: { type: QUEEN, color: BLACK },
        [F5]: { type: ROOK, color: BLACK },
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

    test("a white pawn captures en passant on its right diagonal", () => {
      const c = moveCtx(
        (b) => {
          Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
          Board.place(b, F5, Square.create({ type: PAWN, color: BLACK }));
        },
        WHITE,
        F6,
      );

      const moves = pawn.pseudoLegalMoves([], E5, c);

      expect(dests(moves)).toEqual([E6, F6]);

      const ep = moves.find((m) => m.to === F6);
      expect(ep).toBeDefined();
      expect(ep!.type).toBe(EN_PASSANT);
      expect(ep!.captured).toEqual({ type: PAWN, color: BLACK });
    });

    test("a white pawn captures en passant on its left diagonal", () => {
      const c = moveCtx(
        (b) => {
          Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
          Board.place(b, D5, Square.create({ type: PAWN, color: BLACK }));
        },
        WHITE,
        D6,
      );

      const moves = pawn.pseudoLegalMoves([], E5, c);

      expect(dests(moves)).toEqual([E6, D6]);
    });

    test("a black pawn captures en passant", () => {
      const c = moveCtx(
        (b) => {
          Board.place(b, E4, Square.create({ type: PAWN, color: BLACK }));
          Board.place(b, D4, Square.create({ type: PAWN, color: WHITE }));
        },
        BLACK,
        D3,
      );

      const moves = pawn.pseudoLegalMoves([], E4, c);

      expect(dests(moves)).toEqual([E3, D3]);

      const ep = moves.find((m) => m.to === D3);
      expect(ep).toBeDefined();
      expect(ep!.type).toBe(EN_PASSANT);
      expect(ep!.captured).toEqual({ type: PAWN, color: WHITE });
    });

    test("an en passant target not on a diagonal is ignored", () => {
      const c = moveCtx((b) => Board.place(b, E5, Square.create({ type: PAWN, color: WHITE })), WHITE, E6);

      const moves = pawn.pseudoLegalMoves([], E5, c);

      expect(dests(moves)).toEqual([E6]);
      expect(moves.every((m) => m.type !== EN_PASSANT)).toBe(true);
    });

    test("a white pawn reaching the last rank by forward push promotes to Q, R, B, or N", () => {
      const c = moveCtx((b) => Board.place(b, E7, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      expect(moves).toHaveLength(4);

      const promoteTypes = new Set(moves.map((m) => m.promoteTo));
      expect(promoteTypes).toEqual(new Set([QUEEN, ROOK, BISHOP, KNIGHT]));

      for (const m of moves) {
        expect(m.to).toBe(E8);
        expect(m.type).toBe(PROMOTION);
        expect(m.captured).toBeNull();
      }
    });

    test("a black pawn reaching the last rank by forward push promotes", () => {
      const c = moveCtx((b) => Board.place(b, E2, Square.create({ type: PAWN, color: BLACK })), BLACK);
      const moves = pawn.pseudoLegalMoves([], E2, c);

      expect(moves).toHaveLength(4);
      for (const m of moves) {
        expect(m.to).toBe(E1);
        expect(m.type).toBe(PROMOTION);
      }
    });

    test("a promotion with a diagonal capture produces 4 capture-promotion moves", () => {
      const c = moveCtx((b) => {
        Board.place(b, E7, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D8, Square.create({ type: ROOK, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      expect(moves).toHaveLength(8);

      const forwardMoves = moves.filter((m) => m.to === E8);
      expect(forwardMoves).toHaveLength(4);
      for (const m of forwardMoves) {
        expect(m.captured).toBeNull();
      }

      const captureMoves = moves.filter((m) => m.to === D8);
      expect(captureMoves).toHaveLength(4);
      for (const m of captureMoves) {
        expect(m.captured).toEqual({ type: ROOK, color: BLACK });
      }
    });

    test("a promotion with captures on both diagonals plus forward produces 12 moves", () => {
      const c = moveCtx((b) => {
        Board.place(b, E7, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D8, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(b, F8, Square.create({ type: KNIGHT, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      expect(moves).toHaveLength(12);
    });

    test("a pawn whose promotion square is blocked can still capture diagonally", () => {
      const c = moveCtx((b) => {
        Board.place(b, E7, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, D8, Square.create({ type: QUEEN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      expect(moves).toHaveLength(4);
      for (const m of moves) {
        expect(m.to).toBe(D8);
      }
    });

    test("a pawn with no promotion moves (forward blocked, no diagonal captures) yields nothing", () => {
      const c = moveCtx((b) => {
        Board.place(b, E7, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E8, Square.create({ type: ROOK, color: WHITE }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      expect(moves).toHaveLength(0);
    });

    test("a pawn on the A file has no left diagonal (only right capture)", () => {
      const c = moveCtx((b) => {
        Board.place(b, A4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, B5, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], A4, c);

      expect(dests(moves)).toEqual([A5, B5]);
    });

    test("a pawn on the H file has no right diagonal (only left capture)", () => {
      const c = moveCtx((b) => {
        Board.place(b, H4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, G5, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);
      const moves = pawn.pseudoLegalMoves([], H4, c);

      expect(dests(moves)).toEqual([H5, G5]);
    });

    test("a black pawn captures downward (white pieces are enemies)", () => {
      const c = moveCtx((b) => {
        Board.place(b, E5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D4, Square.create({ type: PAWN, color: WHITE }));
      }, BLACK);
      const moves = pawn.pseudoLegalMoves([], E5, c);

      expect(dests(moves)).toEqual([E4, D4]);

      const capture = moves.find((m) => m.to === D4);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: WHITE });
    });

    test("a black pawn treats black pieces as own (not capturable)", () => {
      const c = moveCtx((b) => {
        Board.place(b, E5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D4, Square.create({ type: PAWN, color: BLACK }));
      }, BLACK);
      const moves = pawn.pseudoLegalMoves([], E5, c);

      expect(dests(moves)).toEqual([E4]);
    });

    test("every non-promotion move has type NORMAL and carries the mover and source", () => {
      const c = moveCtx((b) => Board.place(b, E2, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = pawn.pseudoLegalMoves([], E2, c);

      for (const m of moves) {
        expect(m.type).toBe(NORMAL);
        expect(m.piece).toEqual({ type: PAWN, color: WHITE });
        expect(m.from).toBe(E2);
      }
    });

    test("a promotion move carries PROMOTION type and the correct piece/from", () => {
      const c = moveCtx((b) => Board.place(b, E7, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = pawn.pseudoLegalMoves([], E7, c);

      for (const m of moves) {
        expect(m.type).toBe(PROMOTION);
        expect(m.piece).toEqual({ type: PAWN, color: WHITE });
        expect(m.from).toBe(E7);
      }
    });
  });
});
