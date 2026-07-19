import { describe, expect, test } from "bun:test";

import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { NORMAL } from "../core/move";
import type { Piece } from "../core/piece";
import { BISHOP, BLACK, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import type { Position } from "../core/position";
import {
  A1,
  A4,
  A7,
  A8,
  B1,
  B2,
  B3,
  B5,
  B6,
  B7,
  C2,
  C3,
  C5,
  C6,
  D1,
  D3,
  D4,
  D5,
  D7,
  E3,
  E4,
  E5,
  E7,
  E8,
  F2,
  F3,
  F5,
  F6,
  G1,
  G2,
  G6,
  G7,
  H1,
  H4,
  H7,
  H8,
  NO_POSITION,
} from "../core/position";
import type { BoardContext, MoveContext } from "../core/state";
import { SideState } from "../core/state";
import { Bishop } from "./bishop";

describe("Bishop", () => {
  const bishop = new Bishop();

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
    test("a white bishop on any of the four diagonals through E4 attacks E4", () => {
      for (const from of [H7, A8, H1, B1] as const) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: BISHOP, color: WHITE })));
        expect(bishop.isAttacking(WHITE, E4, c)).toBe(true);
      }
    });

    test("a bishop adjacent to the target attacks (distance 1)", () => {
      const c = boardCtx((b) => Board.place(b, D3, Square.create({ type: BISHOP, color: WHITE })));
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a bishop at maximum diagonal distance attacks (H8 to A1)", () => {
      const c = boardCtx((b) => Board.place(b, H8, Square.create({ type: BISHOP, color: WHITE })));
      expect(bishop.isAttacking(WHITE, A1, c)).toBe(true);
    });

    test("a bishop on a non-diagonal square does not attack E4", () => {
      for (const from of [E7, H4, F6] as const) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: BISHOP, color: WHITE })));
        expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("a friendly piece between the bishop and the target blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, F5, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("an enemy piece between the bishop and the target blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, F5, Square.create({ type: PAWN, color: BLACK }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a piece behind the target does not block", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, C2, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("with two bishops on the same diagonal, the closer one attacks and blocks the farther", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, F5, Square.create({ type: BISHOP, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a bishop of the wrong color is ignored", () => {
      const c = boardCtx((b) => Board.place(b, H7, Square.create({ type: BISHOP, color: BLACK })));
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
      expect(bishop.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a non-bishop piece on the diagonal does not trigger a bishop attack", () => {
      for (const pt of [QUEEN, ROOK, PAWN, KNIGHT] as const) {
        const c = boardCtx((b) => Board.place(b, H7, Square.create({ type: pt, color: WHITE })));
        expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("an empty board reports no attack", () => {
      const c = boardCtx(() => {});
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("corner-to-corner diagonals: each corner is attacked by the opposite corner", () => {
      const pairs: [Position, Position][] = [
        [A1, H8],
        [H8, A1],
        [A8, H1],
        [H1, A8],
      ];
      for (const [target, from] of pairs) {
        const c = boardCtx((b) => Board.place(b, from, Square.create({ type: BISHOP, color: WHITE })));
        expect(bishop.isAttacking(WHITE, target, c)).toBe(true);
      }
    });

    test("a bishop sitting on the target square itself does not attack it", () => {
      const c = boardCtx((b) => Board.place(b, E4, Square.create({ type: BISHOP, color: WHITE })));
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("among multiple bishops, any matching-color bishop on a clear diagonal attacks", () => {
      const c = boardCtx((b) => {
        Board.place(b, A1, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, H1, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, A8, Square.create({ type: BISHOP, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("multiple enemy bishops with all diagonals blocked do not attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, A7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, H1, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, B1, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, F5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, F3, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D3, Square.create({ type: PAWN, color: BLACK }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("mixed-color bishops: only the matching color counts", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: BLACK }));
        Board.place(b, A8, Square.create({ type: BISHOP, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a blocker immediately adjacent to the target blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, F5, Square.create({ type: ROOK, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a blocker immediately adjacent to the bishop blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, H7, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(b, G6, Square.create({ type: ROOK, color: WHITE }));
      });
      expect(bishop.isAttacking(WHITE, E4, c)).toBe(false);
    });
  });

  describe("attacks", () => {
    test("bishop on center D4 with an empty board threatens 13 squares along 4 diagonals", () => {
      const c = boardCtx(() => {});
      const got = bishop.attacks([], D4, c);
      expect(got).toEqual([E5, F6, G7, H8, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("bishop on corner A1 threatens 7 squares along its single diagonal", () => {
      const c = boardCtx(() => {});
      expect(bishop.attacks([], A1, c)).toEqual([B2, C3, D4, E5, F6, G7, H8]);
    });

    test("bishop on corner H1 threatens 7 squares along its single diagonal", () => {
      const c = boardCtx(() => {});
      expect(bishop.attacks([], H1, c)).toEqual([G2, F3, E4, D5, C6, B7, A8]);
    });

    test("bishop on corner A8 threatens 7 squares along its single diagonal", () => {
      const c = boardCtx(() => {});
      expect(bishop.attacks([], A8, c)).toEqual([B7, C6, D5, E4, F3, G2, H1]);
    });

    test("bishop on corner H8 threatens 7 squares along its single diagonal", () => {
      const c = boardCtx(() => {});
      expect(bishop.attacks([], H8, c)).toEqual([G7, F6, E5, D4, C3, B2, A1]);
    });

    test("bishop on edge A4 threatens 7 squares along its two diagonals", () => {
      const c = boardCtx(() => {});
      expect(bishop.attacks([], A4, c)).toEqual([B5, C6, D7, E8, B3, C2, D1]);
    });

    test("a blocker on the diagonal stops the scan but is included in the attacks", () => {
      const c = boardCtx((b) => Board.place(b, F6, Square.create({ type: PAWN, color: WHITE })));
      const got = bishop.attacks([], D4, c);
      expect(got).toEqual([E5, F6, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("a bishop surrounded by pieces on all four adjacent diagonals threatens only those 4 squares", () => {
      const c = boardCtx((b) => {
        Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C3, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(bishop.attacks([], D4, c)).toEqual([E5, E3, C5, C3]);
    });

    test("a blocker on a corner bishop's diagonal stops it early", () => {
      const c = boardCtx((b) => Board.place(b, C3, Square.create({ type: PAWN, color: WHITE })));
      expect(bishop.attacks([], A1, c)).toEqual([B2, C3]);
    });

    test("an enemy piece on the diagonal is included in the attacks (attacks does not filter by color)", () => {
      const c = boardCtx((b) => Board.place(b, F6, Square.create({ type: PAWN, color: BLACK })));
      const got = bishop.attacks([], D4, c);
      expect(got).toEqual([E5, F6, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });
  });

  describe("pseudoLegalMoves", () => {
    function dests(moves: Move[]): Position[] {
      return moves.map((m) => m.to);
    }

    const d4Empty: Position[] = [E5, F6, G7, H8, E3, F2, G1, C5, B6, A7, C3, B2, A1];

    test("bishop on center D4 with an empty board has 13 moves along 4 diagonals", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = bishop.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual(d4Empty);
    });

    test("a square occupied by an enemy piece is included as a capture and stops the slide", () => {
      const c = moveCtx((b) => Board.place(b, F6, Square.create({ type: PAWN, color: BLACK })), WHITE);
      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E5, F6, E3, F2, G1, C5, B6, A7, C3, B2, A1]);

      const capture = moves.find((m) => m.to === F6);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: BLACK });
    });

    test("captures carry the exact enemy piece type and color sitting on the destination", () => {
      const c = moveCtx((b) => {
        Board.place(b, F6, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(b, F3, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, B6, Square.create({ type: KNIGHT, color: BLACK }));
      }, WHITE);

      const moves = bishop.pseudoLegalMoves([], D4, c);

      const wantCaptures: Record<number, Piece> = {
        [F6]: { type: QUEEN, color: BLACK },
        [F3]: { type: ROOK, color: BLACK },
        [B6]: { type: KNIGHT, color: BLACK },
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

    test("a square occupied by a friendly piece is excluded and stops the slide", () => {
      const c = moveCtx((b) => Board.place(b, F6, Square.create({ type: PAWN, color: WHITE })), WHITE);
      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E5, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("a friendly piece blocks the slide; an enemy behind it is unreachable", () => {
      const c = moveCtx((b) => {
        Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, F6, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);

      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("an enemy piece blocks the slide but is capturable; nothing beyond it is reachable", () => {
      const c = moveCtx((b) => {
        Board.place(b, F6, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, H8, Square.create({ type: ROOK, color: BLACK }));
      }, WHITE);

      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E5, F6, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("after capturing an enemy, a friendly piece behind it is unreachable", () => {
      const c = moveCtx((b) => {
        Board.place(b, F6, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, H8, Square.create({ type: ROOK, color: WHITE }));
      }, WHITE);

      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E5, F6, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("a mix of friendly and enemy on all four diagonals yields only the captures", () => {
      const c = moveCtx((b) => {
        Board.place(b, E5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, E3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, C3, Square.create({ type: PAWN, color: WHITE }));
      }, WHITE);

      const moves = bishop.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([E5, C5]);
    });

    test("all four diagonals blocked by own pieces yields no moves", () => {
      const c = moveCtx((b) => {
        Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C3, Square.create({ type: PAWN, color: WHITE }));
      }, WHITE);

      const moves = bishop.pseudoLegalMoves([], D4, c);
      expect(moves).toHaveLength(0);
    });

    test("a black bishop treats white pieces as enemies (captures) and black as own", () => {
      const c = moveCtx((b) => Board.place(b, F6, Square.create({ type: PAWN, color: WHITE })), BLACK);
      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E5, F6, E3, F2, G1, C5, B6, A7, C3, B2, A1]);

      const capture = moves.find((m) => m.to === F6);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: WHITE });
    });

    test("a black bishop treats black pieces as own (excluded)", () => {
      const c = moveCtx((b) => Board.place(b, F6, Square.create({ type: PAWN, color: BLACK })), BLACK);
      const moves = bishop.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([E5, E3, F2, G1, C5, B6, A7, C3, B2, A1]);
    });

    test("every generated move has type NORMAL and carries the mover and source square", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = bishop.pseudoLegalMoves([], D4, c);

      for (const m of moves) {
        expect(m.type).toBe(NORMAL);
        expect(m.piece).toEqual({ type: BISHOP, color: WHITE });
        expect(m.from).toBe(D4);
      }
    });
  });
});
