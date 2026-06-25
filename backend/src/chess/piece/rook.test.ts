import type { Move } from "../core/move";
import type { BoardContext, MoveContext } from "../core/state";

import { Rook } from "./rook";
import { NORMAL } from "../core/move";
import { SideState } from "../core/state";
import { Board, Square } from "../core/board";
import { describe, expect, test } from "bun:test";
import type { Piece } from "../core/piece";
import {
  ROOK,
  PAWN,
  QUEEN,
  BISHOP,
  KNIGHT,
  KING,
  WHITE,
  BLACK,
} from "../core/piece";
import {
  Position,
  NO_POSITION,
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  A8,
  B1,
  B4,
  B8,
  C1,
  C4,
  C8,
  D1,
  D2,
  D3,
  D4,
  D5,
  D6,
  D7,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E6,
  E7,
  E8,
  F1,
  F4,
  F6,
  F8,
  G1,
  G4,
  G6,
  G8,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  H7,
  H8,
} from "../core/position";

describe("Rook", () => {
  const rook = new Rook();

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
    test("a white rook on any of the four orthogonal lines through E4 attacks E4", () => {
      for (const from of [E7, E1, A4, H4] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: ROOK, color: WHITE })),
        );
        expect(rook.isAttacking(WHITE, E4, c)).toBe(true);
      }
    });

    test("a rook adjacent to the target attacks (distance 1)", () => {
      const c = boardCtx((b) =>
        Board.place(b, E5, Square.create({ type: ROOK, color: WHITE })),
      );
      expect(rook.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a rook at maximum line distance attacks (A8 to A1)", () => {
      const c = boardCtx((b) =>
        Board.place(b, A8, Square.create({ type: ROOK, color: WHITE })),
      );
      expect(rook.isAttacking(WHITE, A1, c)).toBe(true);
    });

    test("a rook on a non-orthogonal square does not attack E4", () => {
      for (const from of [D5, G6, F6] as const) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: ROOK, color: WHITE })),
        );
        expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("a friendly piece between the rook and the target blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("an enemy piece between the rook and the target blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E5, Square.create({ type: PAWN, color: BLACK }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a piece behind the target does not block", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E2, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("with two rooks on the same line, the closer one attacks and blocks the farther", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E5, Square.create({ type: ROOK, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a rook of the wrong color is ignored", () => {
      const c = boardCtx((b) =>
        Board.place(b, E7, Square.create({ type: ROOK, color: BLACK })),
      );
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
      expect(rook.isAttacking(BLACK, E4, c)).toBe(true);
    });

    test("a non-rook piece on the line does not trigger a rook attack", () => {
      for (const pt of [QUEEN, BISHOP, KNIGHT, KING, PAWN] as const) {
        const c = boardCtx((b) =>
          Board.place(b, E7, Square.create({ type: pt, color: WHITE })),
        );
        expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
      }
    });

    test("an empty board reports no attack", () => {
      const c = boardCtx(() => {});
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a corner is attacked along both its file and its rank", () => {
      const pairs: [Position, Position][] = [
        [A1, A8],
        [A1, H1],
        [H8, H1],
        [H8, A8],
      ];
      for (const [target, from] of pairs) {
        const c = boardCtx((b) =>
          Board.place(b, from, Square.create({ type: ROOK, color: WHITE })),
        );
        expect(rook.isAttacking(WHITE, target, c)).toBe(true);
      }
    });

    test("a rook sitting on the target square itself does not attack it", () => {
      const c = boardCtx((b) =>
        Board.place(b, E4, Square.create({ type: ROOK, color: WHITE })),
      );
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("among multiple rooks, any matching-color rook on a clear line attacks", () => {
      const c = boardCtx((b) => {
        Board.place(b, A4, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E8, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, H4, Square.create({ type: ROOK, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("multiple enemy rooks with all lines blocked do not attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, E8, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, A4, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, H4, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, E3, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D4, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, F4, Square.create({ type: PAWN, color: BLACK }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("mixed-color rooks: only the matching color counts", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, A4, Square.create({ type: ROOK, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(true);
    });

    test("a blocker immediately adjacent to the target blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E5, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });

    test("a blocker immediately adjacent to the rook blocks the attack", () => {
      const c = boardCtx((b) => {
        Board.place(b, E7, Square.create({ type: ROOK, color: WHITE }));
        Board.place(b, E6, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(rook.isAttacking(WHITE, E4, c)).toBe(false);
    });
  });

  describe("attacks", () => {
    test("rook on center D4 with an empty board threatens 14 squares along 4 lines", () => {
      const c = boardCtx(() => {});
      const got = rook.attacks([], D4, c);
      expect(got).toEqual([
        D5,
        D6,
        D7,
        D8,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);
    });

    test("rook on corner A1 threatens 14 squares along its two lines", () => {
      const c = boardCtx(() => {});
      expect(rook.attacks([], A1, c)).toEqual([
        A2,
        A3,
        A4,
        A5,
        A6,
        A7,
        A8,
        B1,
        C1,
        D1,
        E1,
        F1,
        G1,
        H1,
      ]);
    });

    test("rook on corner H1 threatens 14 squares along its two lines", () => {
      const c = boardCtx(() => {});
      expect(rook.attacks([], H1, c)).toEqual([
        H2,
        H3,
        H4,
        H5,
        H6,
        H7,
        H8,
        G1,
        F1,
        E1,
        D1,
        C1,
        B1,
        A1,
      ]);
    });

    test("rook on corner A8 threatens 14 squares along its two lines", () => {
      const c = boardCtx(() => {});
      expect(rook.attacks([], A8, c)).toEqual([
        A7,
        A6,
        A5,
        A4,
        A3,
        A2,
        A1,
        B8,
        C8,
        D8,
        E8,
        F8,
        G8,
        H8,
      ]);
    });

    test("rook on corner H8 threatens 14 squares along its two lines", () => {
      const c = boardCtx(() => {});
      expect(rook.attacks([], H8, c)).toEqual([
        H7,
        H6,
        H5,
        H4,
        H3,
        H2,
        H1,
        G8,
        F8,
        E8,
        D8,
        C8,
        B8,
        A8,
      ]);
    });

    test("rook on edge A4 threatens 14 squares along its three lines", () => {
      const c = boardCtx(() => {});
      expect(rook.attacks([], A4, c)).toEqual([
        A5,
        A6,
        A7,
        A8,
        A3,
        A2,
        A1,
        B4,
        C4,
        D4,
        E4,
        F4,
        G4,
        H4,
      ]);
    });

    test("a friendly blocker on the line stops the scan but is included in the attacks", () => {
      const c = boardCtx((b) =>
        Board.place(b, D6, Square.create({ type: PAWN, color: WHITE })),
      );
      const got = rook.attacks([], D4, c);
      expect(got).toEqual([D5, D6, D3, D2, D1, C4, B4, A4, E4, F4, G4, H4]);
    });

    test("an enemy blocker on the line stops the scan but is included in the attacks", () => {
      const c = boardCtx((b) =>
        Board.place(b, D6, Square.create({ type: PAWN, color: BLACK })),
      );
      const got = rook.attacks([], D4, c);
      expect(got).toEqual([D5, D6, D3, D2, D1, C4, B4, A4, E4, F4, G4, H4]);
    });

    test("a rook surrounded by pieces on all four adjacent squares threatens only those 4 squares", () => {
      const c = boardCtx((b) => {
        Board.place(b, D5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
      });
      expect(rook.attacks([], D4, c)).toEqual([D5, D3, C4, E4]);
    });

    test("a blocker on a corner rook's line stops it early", () => {
      const c = boardCtx((b) =>
        Board.place(b, A3, Square.create({ type: PAWN, color: WHITE })),
      );
      expect(rook.attacks([], A1, c)).toEqual([
        A2,
        A3,
        B1,
        C1,
        D1,
        E1,
        F1,
        G1,
        H1,
      ]);
    });
  });

  describe("pseudoLegalMoves", () => {
    function dests(moves: Move[]): Position[] {
      return moves.map((m) => m.to);
    }

    const d4Empty: Position[] = [
      D5,
      D6,
      D7,
      D8,
      D3,
      D2,
      D1,
      C4,
      B4,
      A4,
      E4,
      F4,
      G4,
      H4,
    ];

    test("rook on center D4 with an empty board has 14 moves along 4 lines", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = rook.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual(d4Empty);
      expect(moves).toHaveLength(14);
    });

    test("a square occupied by an enemy piece is included as a capture and stops the slide", () => {
      const c = moveCtx(
        (b) => Board.place(b, D6, Square.create({ type: PAWN, color: BLACK })),
        WHITE,
      );
      const moves = rook.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([
        D5,
        D6,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);

      const capture = moves.find((m) => m.to === D6);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: BLACK });
    });

    test("captures carry the exact enemy piece type and color sitting on the destination", () => {
      const c = moveCtx((b) => {
        Board.place(b, D6, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(b, D1, Square.create({ type: ROOK, color: BLACK }));
        Board.place(b, B4, Square.create({ type: KNIGHT, color: BLACK }));
      }, WHITE);

      const moves = rook.pseudoLegalMoves([], D4, c);

      const wantCaptures: Record<number, Piece> = {
        [D6]: { type: QUEEN, color: BLACK },
        [D1]: { type: ROOK, color: BLACK },
        [B4]: { type: KNIGHT, color: BLACK },
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
      const c = moveCtx(
        (b) => Board.place(b, D6, Square.create({ type: PAWN, color: WHITE })),
        WHITE,
      );
      const moves = rook.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([
        D5,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);
    });

    test("a friendly piece blocks the slide; an enemy behind it is unreachable", () => {
      const c = moveCtx((b) => {
        Board.place(b, D5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D6, Square.create({ type: PAWN, color: BLACK }));
      }, WHITE);

      const moves = rook.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([D3, D2, D1, C4, B4, A4, E4, F4, G4, H4]);
    });

    test("an enemy piece blocks the slide but is capturable; nothing beyond it is reachable", () => {
      const c = moveCtx((b) => {
        Board.place(b, D6, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D8, Square.create({ type: ROOK, color: BLACK }));
      }, WHITE);

      const moves = rook.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([
        D5,
        D6,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);
    });

    test("after capturing an enemy, a friendly piece behind it is unreachable", () => {
      const c = moveCtx((b) => {
        Board.place(b, D6, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D8, Square.create({ type: ROOK, color: WHITE }));
      }, WHITE);

      const moves = rook.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([
        D5,
        D6,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);
    });

    test("a mix of friendly and enemy on all four lines yields only the captures", () => {
      const c = moveCtx((b) => {
        Board.place(b, D5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, D3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C4, Square.create({ type: PAWN, color: BLACK }));
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
      }, WHITE);

      const moves = rook.pseudoLegalMoves([], D4, c);
      expect(dests(moves)).toEqual([D5, C4]);
    });

    test("all four lines blocked by own pieces yields no moves", () => {
      const c = moveCtx((b) => {
        Board.place(b, D5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, D3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, C4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
      }, WHITE);

      const moves = rook.pseudoLegalMoves([], D4, c);
      expect(moves).toHaveLength(0);
    });

    test("a black rook treats white pieces as enemies (captures) and black as own", () => {
      const c = moveCtx(
        (b) => Board.place(b, D6, Square.create({ type: PAWN, color: WHITE })),
        BLACK,
      );
      const moves = rook.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([
        D5,
        D6,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);

      const capture = moves.find((m) => m.to === D6);
      expect(capture).toBeDefined();
      expect(capture!.captured).toEqual({ type: PAWN, color: WHITE });
    });

    test("a black rook treats black pieces as own (excluded)", () => {
      const c = moveCtx(
        (b) => Board.place(b, D6, Square.create({ type: PAWN, color: BLACK })),
        BLACK,
      );
      const moves = rook.pseudoLegalMoves([], D4, c);

      expect(dests(moves)).toEqual([
        D5,
        D3,
        D2,
        D1,
        C4,
        B4,
        A4,
        E4,
        F4,
        G4,
        H4,
      ]);
    });

    test("every generated move has type NORMAL and carries the mover and source square", () => {
      const c = moveCtx(() => {}, WHITE);
      const moves = rook.pseudoLegalMoves([], D4, c);

      for (const m of moves) {
        expect(m.type).toBe(NORMAL);
        expect(m.piece).toEqual({ type: ROOK, color: WHITE });
        expect(m.from).toBe(D4);
      }
    });
  });
});
