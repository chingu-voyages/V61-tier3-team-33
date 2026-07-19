import { describe, expect, test } from "bun:test";

import { Board, Square } from "../core/board";
import type { PieceColor } from "../core/piece";
import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import type { Position } from "../core/position";
import {
  A1,
  A3,
  A4,
  A5,
  A8,
  B2,
  B3,
  C3,
  D4,
  D6,
  D7,
  E2,
  E3,
  E4,
  E5,
  E6,
  E7,
  F4,
  F6,
  F7,
  G7,
  H8,
} from "../core/position";
import type { BoardContext } from "../core/state";
import { getDefaultPieces } from "../piece/default";
import { isSquareAttackedImpl } from "./attack";

describe("Engine", () => {
  describe("isSquareAttacked", () => {
    const pieces = getDefaultPieces();

    function withBoard(setup: (b: Board) => void): BoardContext {
      const board = Board.create();
      setup(board);
      return { board };
    }

    function assertAttack(target: Position, color: PieceColor, ctx: BoardContext, want: boolean): void {
      expect(isSquareAttackedImpl(pieces, target, color, ctx)).toBe(want);
    }

    describe("knight", () => {
      test("a knight on a valid L-shape from E5 attacks E5", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D7, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a knight on a non-L-shape square does not attack E5", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D6, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a knight attacks from a corner L-shape (H8 to F7)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, H8, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(F7, WHITE, ctx, true);
      });
    });

    describe("king", () => {
      test("a king on an orthogonally adjacent square attacks E5", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E6, Square.create({ type: KING, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a king on a diagonally adjacent square attacks E5", () => {
        const ctx = withBoard((b) => {
          Board.place(b, F6, Square.create({ type: KING, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a king two squares away does not attack E5", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E7, Square.create({ type: KING, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });
    });

    describe("pawn", () => {
      test("a white pawn attacks E5 from below-left (D4)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D4, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a white pawn attacks E5 from below-right (F4)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, F4, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a white pawn does not attack E5 from above (pawns attack upward only)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D6, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a white pawn does not attack E5 from the same file (pawns attack diagonally only)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E4, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a black pawn attacks E5 from above-left (D6)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D6, Square.create({ type: PAWN, color: BLACK }));
        });
        assertAttack(E5, BLACK, ctx, true);
      });

      test("a black pawn attacks E5 from above-right (F6)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, F6, Square.create({ type: PAWN, color: BLACK }));
        });
        assertAttack(E5, BLACK, ctx, true);
      });

      test("a black pawn does not attack E5 from below (black pawns attack downward only)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D4, Square.create({ type: PAWN, color: BLACK }));
        });
        assertAttack(E5, BLACK, ctx, false);
      });
    });

    describe("bishop", () => {
      test("a bishop attacks along a clear long diagonal (B2 to E5)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: BISHOP, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a bishop attacks along a short diagonal (D4 to E5)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D4, Square.create({ type: BISHOP, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a bishop blocked by a friendly piece between it and the target does not attack", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: BISHOP, color: WHITE }));
          Board.place(b, D4, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a bishop blocked by an enemy piece between it and the target does not attack", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: BISHOP, color: WHITE }));
          Board.place(b, D4, Square.create({ type: PAWN, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a bishop does not attack orthogonally (same file, not diagonal)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E3, Square.create({ type: BISHOP, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });
    });

    describe("rook", () => {
      test("a rook attacks along a clear file (E2 to E5)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E2, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a rook attacks along a clear rank (A5 to E5)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, A5, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a rook blocked by a friendly piece between it and the target does not attack", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E2, Square.create({ type: ROOK, color: WHITE }));
          Board.place(b, E4, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a rook blocked by an enemy piece between it and the target does not attack", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E2, Square.create({ type: ROOK, color: WHITE }));
          Board.place(b, E4, Square.create({ type: PAWN, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a rook does not attack diagonally", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D4, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });
    });

    describe("queen", () => {
      test("a queen on a diagonal is caught by the bishop-path scan (B2 to E5)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: QUEEN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a queen on an orthogonal line is caught by the rook-path scan (E2 to E5)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E2, Square.create({ type: QUEEN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("a queen blocked on the diagonal by a friendly piece does not attack via that ray", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: QUEEN, color: WHITE }));
          Board.place(b, D4, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a queen blocked orthogonally by an enemy piece does not attack via that ray", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E2, Square.create({ type: QUEEN, color: WHITE }));
          Board.place(b, E4, Square.create({ type: PAWN, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a queen blocked on one ray but clear on another still attacks", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: QUEEN, color: WHITE }));
          Board.place(b, D4, Square.create({ type: KNIGHT, color: WHITE }));
          Board.place(b, A5, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });
    });

    describe("color filtering", () => {
      test("a knight of the wrong color is ignored", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D7, Square.create({ type: KNIGHT, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a king of the wrong color is ignored", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E6, Square.create({ type: KING, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a bishop of the wrong color is ignored", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B2, Square.create({ type: BISHOP, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a rook of the wrong color is ignored", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E2, Square.create({ type: ROOK, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });
    });

    describe("combinations", () => {
      test("multiple attackers of the same color: any one clear attack suffices", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D7, Square.create({ type: KNIGHT, color: WHITE }));
          Board.place(b, E2, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("multiple enemy-color pieces, none matching the queried color, do not attack", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D7, Square.create({ type: KNIGHT, color: BLACK }));
          Board.place(b, E2, Square.create({ type: ROOK, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("mixed colors: a matching-color attacker among wrong-color pieces still attacks", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D7, Square.create({ type: KNIGHT, color: BLACK }));
          Board.place(b, E2, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });

      test("only friendly pieces on the board do not attack (for the enemy color)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, D7, Square.create({ type: KNIGHT, color: BLACK }));
          Board.place(b, E2, Square.create({ type: ROOK, color: BLACK }));
        });
        assertAttack(E5, WHITE, ctx, false);
        assertAttack(E5, BLACK, ctx, true);
      });
    });

    describe("slider blocking edge cases", () => {
      test("a blocker immediately adjacent to the target blocks the slider", () => {
        const ctx = withBoard((b) => {
          Board.place(b, H8, Square.create({ type: BISHOP, color: WHITE }));
          Board.place(b, F6, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a blocker immediately adjacent to the attacker blocks the slider", () => {
        const ctx = withBoard((b) => {
          Board.place(b, H8, Square.create({ type: BISHOP, color: WHITE }));
          Board.place(b, G7, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a piece behind the target does not block (target is between attacker and piece)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, H8, Square.create({ type: BISHOP, color: WHITE }));
          Board.place(b, C3, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });
    });

    describe("edge cases", () => {
      test("an empty board reports no attack", () => {
        const ctx = withBoard(() => {});
        assertAttack(E5, WHITE, ctx, false);
      });

      test("a corner target with no attackers reports no attack", () => {
        const ctx = withBoard(() => {});
        assertAttack(A1, WHITE, ctx, false);
      });

      test("a corner target is attacked by a rook on the opposite end of its file", () => {
        const ctx = withBoard((b) => {
          Board.place(b, A8, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(A1, WHITE, ctx, true);
      });

      test("a corner target is attacked by a bishop on the opposite corner (full diagonal)", () => {
        const ctx = withBoard((b) => {
          Board.place(b, H8, Square.create({ type: BISHOP, color: WHITE }));
        });
        assertAttack(A1, WHITE, ctx, true);
      });

      test("a corner target is attacked by a knight on its only L-shape", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B3, Square.create({ type: KNIGHT, color: WHITE }));
        });
        assertAttack(A1, WHITE, ctx, true);
      });

      test("an edge target is attacked by a king on an adjacent edge square", () => {
        const ctx = withBoard((b) => {
          Board.place(b, A3, Square.create({ type: KING, color: WHITE }));
        });
        assertAttack(A4, WHITE, ctx, true);
      });

      test("an edge target is attacked by a pawn on the only valid diagonal", () => {
        const ctx = withBoard((b) => {
          Board.place(b, B3, Square.create({ type: PAWN, color: WHITE }));
        });
        assertAttack(A4, WHITE, ctx, true);
      });
    });

    describe("target occupancy", () => {
      test("a piece sitting on the target square does not prevent attacks on it", () => {
        const ctx = withBoard((b) => {
          Board.place(b, E5, Square.create({ type: KING, color: BLACK }));
          Board.place(b, E2, Square.create({ type: ROOK, color: WHITE }));
        });
        assertAttack(E5, WHITE, ctx, true);
      });
    });
  });
});
