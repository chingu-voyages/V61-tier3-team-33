import { describe, expect, test } from "bun:test";

import { Board, EMPTY_SQUARE, Square } from "../core/board";
import type { Move } from "../core/move";
import { CASTLING, EN_PASSANT, NORMAL, PROMOTION } from "../core/move";
import { BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import {
  A1,
  A3,
  A5,
  A6,
  A8,
  B5,
  B6,
  C1,
  C8,
  D1,
  D3,
  D4,
  D5,
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
  F8,
  G1,
  G7,
  G8,
  H1,
  H3,
  H6,
  H8,
  NO_POSITION,
} from "../core/position";
import { TurnContext } from "../core/state";
import { applyImpl } from "./apply";

describe("Engine", () => {
  describe("apply", () => {
    function applyCtx(init: (ctx: TurnContext) => void): TurnContext {
      const ctx = TurnContext.create();
      init(ctx);
      return ctx;
    }

    describe("normal moves", () => {
      test("knight moves", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
        });
        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, D4)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, E6))).toBe(KNIGHT);
        expect(Square.pieceColor(Board.at(ctx.board, E6))).toBe(WHITE);
      });

      test("king moves updates king position and clears castling rights", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
          c.sides[0].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: KING, color: WHITE },
          from: E1,
          to: E2,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E1)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, E2))).toBe(KING);
        expect(Square.pieceColor(Board.at(ctx.board, E2))).toBe(WHITE);
        expect(ctx.sides[0].kingPosition).toBe(E2);
        expect(ctx.sides[0].canCastleKingSide).toBe(false);
        expect(ctx.sides[0].canCastleQueenSide).toBe(false);
      });

      test("rook moves from A1 forfeits queen-side right", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
          c.sides[0].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: ROOK, color: WHITE },
          from: A1,
          to: A3,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.sides[0].canCastleQueenSide).toBe(false);
        expect(ctx.sides[0].canCastleKingSide).toBe(true);
      });

      test("rook moves from H1 forfeits king-side right", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
          c.sides[0].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: ROOK, color: WHITE },
          from: H1,
          to: H3,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.sides[0].canCastleKingSide).toBe(false);
        expect(ctx.sides[0].canCastleQueenSide).toBe(true);
      });

      test("black rook from A8 forfeits queen-side right", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, A8, Square.create({ type: ROOK, color: BLACK }));
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
          c.sides[1].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: ROOK, color: BLACK },
          from: A8,
          to: A6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.sides[1].canCastleQueenSide).toBe(false);
        expect(ctx.sides[1].canCastleKingSide).toBe(true);
      });

      test("black rook from H8 forfeits king-side right", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
          c.sides[1].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: ROOK, color: BLACK },
          from: H8,
          to: H6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.sides[1].canCastleKingSide).toBe(false);
        expect(ctx.sides[1].canCastleQueenSide).toBe(true);
      });
    });

    describe("captures", () => {
      test("knight captures enemy pawn", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
          Board.place(c.board, E6, Square.create({ type: PAWN, color: BLACK }));
        });
        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, D4)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, E6))).toBe(KNIGHT);
        expect(Square.pieceColor(Board.at(ctx.board, E6))).toBe(WHITE);
      });

      test("capturing rook on A8 clears opponent queen-side right", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, A8, Square.create({ type: ROOK, color: BLACK }));
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
          c.sides[1].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: ROOK, color: WHITE },
          from: D4,
          to: A8,
          type: NORMAL,
          promoteTo: null,
          captured: { type: ROOK, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(ctx.sides[1].canCastleQueenSide).toBe(false);
        expect(ctx.sides[1].canCastleKingSide).toBe(true);
      });

      test("capturing rook on H1 clears opponent king-side right", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: ROOK, color: BLACK }));
          Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
          c.sides[0].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: ROOK, color: BLACK },
          from: D4,
          to: H1,
          type: NORMAL,
          promoteTo: null,
          captured: { type: ROOK, color: WHITE },
        };
        applyImpl(ctx, move);
        expect(ctx.sides[0].canCastleKingSide).toBe(false);
        expect(ctx.sides[0].canCastleQueenSide).toBe(true);
      });
    });

    describe("en passant", () => {
      test("white en passant", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D5, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, E5, Square.create({ type: PAWN, color: BLACK }));
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: D5,
          to: E6,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, D5)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, E6))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, E6))).toBe(WHITE);
        expect(Board.at(ctx.board, E5)).toBe(EMPTY_SQUARE);
      });

      test("black en passant", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E4, Square.create({ type: PAWN, color: BLACK }));
          Board.place(c.board, D4, Square.create({ type: PAWN, color: WHITE }));
        });
        const move: Move = {
          piece: { type: PAWN, color: BLACK },
          from: E4,
          to: D3,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: WHITE },
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E4)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, D3))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, D3))).toBe(BLACK);
        expect(Board.at(ctx.board, D4)).toBe(EMPTY_SQUARE);
      });

      test("A-file en passant", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, A5, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, B5, Square.create({ type: PAWN, color: BLACK }));
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: A5,
          to: B6,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, A5)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, B6))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, B6))).toBe(WHITE);
        expect(Board.at(ctx.board, B5)).toBe(EMPTY_SQUARE);
      });
    });

    describe("promotion", () => {
      test("white pawn promotes to queen on E8", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E7, Square.create({ type: PAWN, color: WHITE }));
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E7,
          to: E8,
          type: PROMOTION,
          promoteTo: QUEEN,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E7)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, E8))).toBe(QUEEN);
        expect(Square.pieceColor(Board.at(ctx.board, E8))).toBe(WHITE);
      });

      test("promotion with capture replaces rook with knight", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, G7, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: G7,
          to: H8,
          type: PROMOTION,
          promoteTo: KNIGHT,
          captured: { type: ROOK, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, G7)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, H8))).toBe(KNIGHT);
        expect(Square.pieceColor(Board.at(ctx.board, H8))).toBe(WHITE);
      });

      test("promotion on H8 clears opponent king-side rights", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, G7, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
          c.sides[1].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: G7,
          to: H8,
          type: PROMOTION,
          promoteTo: QUEEN,
          captured: { type: ROOK, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(ctx.sides[1].canCastleKingSide).toBe(false);
        expect(ctx.sides[1].canCastleQueenSide).toBe(true);
      });
    });

    describe("castling", () => {
      test("white king-side", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
        });
        const move: Move = {
          piece: { type: KING, color: WHITE },
          from: E1,
          to: G1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E1)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, G1))).toBe(KING);
        expect(Square.pieceColor(Board.at(ctx.board, G1))).toBe(WHITE);
        expect(Square.pieceType(Board.at(ctx.board, F1))).toBe(ROOK);
        expect(Square.pieceColor(Board.at(ctx.board, F1))).toBe(WHITE);
        expect(ctx.sides[0].kingPosition).toBe(G1);
        expect(ctx.sides[0].canCastleKingSide).toBe(false);
        expect(ctx.sides[0].canCastleQueenSide).toBe(false);
      });

      test("white queen-side", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: KING, color: WHITE },
          from: E1,
          to: C1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E1)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, C1))).toBe(KING);
        expect(Square.pieceColor(Board.at(ctx.board, C1))).toBe(WHITE);
        expect(Square.pieceType(Board.at(ctx.board, D1))).toBe(ROOK);
        expect(Square.pieceColor(Board.at(ctx.board, D1))).toBe(WHITE);
        expect(ctx.sides[0].kingPosition).toBe(C1);
        expect(ctx.sides[0].canCastleKingSide).toBe(false);
        expect(ctx.sides[0].canCastleQueenSide).toBe(false);
      });

      test("black king-side", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
        });
        const move: Move = {
          piece: { type: KING, color: BLACK },
          from: E8,
          to: G8,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E8)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, G8))).toBe(KING);
        expect(Square.pieceColor(Board.at(ctx.board, G8))).toBe(BLACK);
        expect(Square.pieceType(Board.at(ctx.board, F8))).toBe(ROOK);
        expect(Square.pieceColor(Board.at(ctx.board, F8))).toBe(BLACK);
        expect(ctx.sides[1].kingPosition).toBe(G8);
        expect(ctx.sides[1].canCastleKingSide).toBe(false);
        expect(ctx.sides[1].canCastleQueenSide).toBe(false);
      });

      test("black queen-side", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          Board.place(c.board, A8, Square.create({ type: ROOK, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleQueenSide = true;
        });
        const move: Move = {
          piece: { type: KING, color: BLACK },
          from: E8,
          to: C8,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(Board.at(ctx.board, E8)).toBe(EMPTY_SQUARE);
        expect(Square.pieceType(Board.at(ctx.board, C8))).toBe(KING);
        expect(Square.pieceColor(Board.at(ctx.board, C8))).toBe(BLACK);
        expect(Square.pieceType(Board.at(ctx.board, D8))).toBe(ROOK);
        expect(Square.pieceColor(Board.at(ctx.board, D8))).toBe(BLACK);
        expect(ctx.sides[1].kingPosition).toBe(C8);
        expect(ctx.sides[1].canCastleKingSide).toBe(false);
        expect(ctx.sides[1].canCastleQueenSide).toBe(false);
      });
    });

    describe("en passant target", () => {
      test("double pawn push sets ep target", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E2, Square.create({ type: PAWN, color: WHITE }));
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.enPassantTarget).toBe(E3);
      });

      test("single pawn push clears ep target", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E4, Square.create({ type: PAWN, color: WHITE }));
          c.enPassantTarget = E3;
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E4,
          to: E5,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.enPassantTarget).toBe(NO_POSITION);
      });

      test("non-pawn move clears ep target", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
          c.enPassantTarget = D3;
        });
        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.enPassantTarget).toBe(NO_POSITION);
      });
    });

    describe("clock maintenance", () => {
      test("pawn move resets halfMoveClock to 0", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E2, Square.create({ type: PAWN, color: WHITE }));
          c.halfMoveClock = 5;
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.halfMoveClock).toBe(0);
      });

      test("capture resets halfMoveClock to 0", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
          Board.place(c.board, E6, Square.create({ type: PAWN, color: BLACK }));
          c.halfMoveClock = 3;
        });
        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        };
        applyImpl(ctx, move);
        expect(ctx.halfMoveClock).toBe(0);
      });

      test("knight move increments halfMoveClock", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
          c.halfMoveClock = 2;
        });
        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.halfMoveClock).toBe(3);
      });

      test("black move increments fullMoveNumber", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E7, Square.create({ type: PAWN, color: BLACK }));
          c.fullMoveNumber = 1;
        });
        const move: Move = {
          piece: { type: PAWN, color: BLACK },
          from: E7,
          to: E5,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.fullMoveNumber).toBe(2);
      });

      test("white move does not increment fullMoveNumber", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E2, Square.create({ type: PAWN, color: WHITE }));
          c.fullMoveNumber = 1;
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.fullMoveNumber).toBe(1);
      });

      test("promotion resets halfMoveClock to 0", () => {
        const ctx = applyCtx((c) => {
          Board.place(c.board, E7, Square.create({ type: PAWN, color: WHITE }));
          c.halfMoveClock = 4;
        });
        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E7,
          to: E8,
          type: PROMOTION,
          promoteTo: QUEEN,
          captured: null,
        };
        applyImpl(ctx, move);
        expect(ctx.halfMoveClock).toBe(0);
      });
    });
  });
});
