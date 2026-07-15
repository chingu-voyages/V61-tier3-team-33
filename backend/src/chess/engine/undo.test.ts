import { describe, expect, test } from "bun:test";

import { Board, EMPTY_SQUARE, Square } from "../core/board";
import type { Snapshot } from "../core/history";
import type { Move } from "../core/move";
import { CASTLING, EN_PASSANT, NORMAL, PROMOTION } from "../core/move";
import { BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import {
  A1,
  A3,
  A5,
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
  H6,
  H8,
  NO_POSITION,
} from "../core/position";
import { SideState, TurnContext } from "../core/state";
import { applyImpl } from "./apply";
import { undoImpl } from "./undo";

describe("Engine", () => {
  describe("undo", () => {
    describe("undo without apply", () => {
      test("undoNormal - restores knight position", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, E6, Square.create({ type: KNIGHT, color: WHITE }));

        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        };
        const snap: Snapshot = {
          move,
          previousSides: [SideState.empty(), SideState.empty()],
          previousEnPassantTarget: NO_POSITION,
          previousHalfMoveClock: 0,
          previousFullMoveNumber: 1,
        };

        undoImpl(ctx, snap);

        expect(Square.pieceType(Board.at(ctx.board, D4))).toBe(KNIGHT);
        expect(Square.pieceColor(Board.at(ctx.board, D4))).toBe(WHITE);
        expect(Board.at(ctx.board, E6)).toBe(EMPTY_SQUARE);
      });

      test("undoNormal with capture - restores both pieces", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, E6, Square.create({ type: KNIGHT, color: WHITE }));

        const move: Move = {
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        };
        const snap: Snapshot = {
          move,
          previousSides: [SideState.empty(), SideState.empty()],
          previousEnPassantTarget: NO_POSITION,
          previousHalfMoveClock: 0,
          previousFullMoveNumber: 1,
        };

        undoImpl(ctx, snap);

        expect(Square.pieceType(Board.at(ctx.board, D4))).toBe(KNIGHT);
        expect(Square.pieceColor(Board.at(ctx.board, D4))).toBe(WHITE);
        expect(Square.pieceType(Board.at(ctx.board, E6))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, E6))).toBe(BLACK);
      });

      test("undoCastling - restores king and rook", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, G1, Square.create({ type: KING, color: WHITE }));
        Board.place(ctx.board, F1, Square.create({ type: ROOK, color: WHITE }));

        const move: Move = {
          piece: { type: KING, color: WHITE },
          from: E1,
          to: G1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        };
        const snap: Snapshot = {
          move,
          previousSides: [
            {
              kingPosition: E1,
              canCastleKingSide: true,
              canCastleQueenSide: false,
            },
            SideState.empty(),
          ],
          previousEnPassantTarget: NO_POSITION,
          previousHalfMoveClock: 0,
          previousFullMoveNumber: 1,
        };

        undoImpl(ctx, snap);

        expect(Square.pieceType(Board.at(ctx.board, E1))).toBe(KING);
        expect(Square.pieceColor(Board.at(ctx.board, E1))).toBe(WHITE);
        expect(Square.pieceType(Board.at(ctx.board, H1))).toBe(ROOK);
        expect(Square.pieceColor(Board.at(ctx.board, H1))).toBe(WHITE);
        expect(Board.at(ctx.board, G1)).toBe(EMPTY_SQUARE);
        expect(Board.at(ctx.board, F1)).toBe(EMPTY_SQUARE);
      });

      test("undoEnPassant - restores both pawns", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, E6, Square.create({ type: PAWN, color: WHITE }));
        Board.clear(ctx.board, D5);
        Board.clear(ctx.board, E5);

        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: D5,
          to: E6,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        };
        const snap: Snapshot = {
          move,
          previousSides: [SideState.empty(), SideState.empty()],
          previousEnPassantTarget: E6,
          previousHalfMoveClock: 0,
          previousFullMoveNumber: 1,
        };

        undoImpl(ctx, snap);

        expect(Square.pieceType(Board.at(ctx.board, D5))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, D5))).toBe(WHITE);
        expect(Square.pieceType(Board.at(ctx.board, E5))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, E5))).toBe(BLACK);
        expect(Board.at(ctx.board, E6)).toBe(EMPTY_SQUARE);
      });

      test("undoPromotion - restores pawn", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, E8, Square.create({ type: QUEEN, color: WHITE }));

        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: E7,
          to: E8,
          type: PROMOTION,
          promoteTo: QUEEN,
          captured: null,
        };
        const snap: Snapshot = {
          move,
          previousSides: [SideState.empty(), SideState.empty()],
          previousEnPassantTarget: NO_POSITION,
          previousHalfMoveClock: 0,
          previousFullMoveNumber: 1,
        };

        undoImpl(ctx, snap);

        expect(Square.pieceType(Board.at(ctx.board, E7))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, E7))).toBe(WHITE);
        expect(Board.at(ctx.board, E8)).toBe(EMPTY_SQUARE);
      });

      test("undoPromotion with capture - restores pawn and captured piece", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, H8, Square.create({ type: KNIGHT, color: WHITE }));

        const move: Move = {
          piece: { type: PAWN, color: WHITE },
          from: G7,
          to: H8,
          type: PROMOTION,
          promoteTo: KNIGHT,
          captured: { type: ROOK, color: BLACK },
        };
        const snap: Snapshot = {
          move,
          previousSides: [SideState.empty(), SideState.empty()],
          previousEnPassantTarget: NO_POSITION,
          previousHalfMoveClock: 0,
          previousFullMoveNumber: 1,
        };

        undoImpl(ctx, snap);

        expect(Square.pieceType(Board.at(ctx.board, G7))).toBe(PAWN);
        expect(Square.pieceColor(Board.at(ctx.board, G7))).toBe(WHITE);
        expect(Square.pieceType(Board.at(ctx.board, H8))).toBe(ROOK);
        expect(Square.pieceColor(Board.at(ctx.board, H8))).toBe(BLACK);
      });
    });

    describe("apply then undo round-trip", () => {
      function roundTrip(
        label: string,
        setup: (ctx: TurnContext) => void,
        makeMove: (ctx: TurnContext) => Move,
        check: (original: TurnContext, ctx: TurnContext) => void,
      ): void {
        test(label, () => {
          const ctx = TurnContext.create();
          setup(ctx);
          const original = TurnContext.copy(ctx);
          const move = makeMove(ctx);
          const snap = applyImpl(ctx, move);
          undoImpl(ctx, snap);
          check(original, ctx);
        });
      }

      roundTrip(
        "normal knight move (no capture)",
        (c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
        },
        () => ({
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, D4)).toBe(Board.at(o.board, D4));
          expect(Board.at(c.board, E6)).toBe(Board.at(o.board, E6));
        },
      );

      roundTrip(
        "king move restores kingPosition and castling rights",
        (c) => {
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
          c.sides[0].canCastleQueenSide = true;
        },
        () => ({
          piece: { type: KING, color: WHITE },
          from: E1,
          to: E2,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E1)).toBe(Board.at(o.board, E1));
          expect(Board.at(c.board, E2)).toBe(Board.at(o.board, E2));
          expect(c.sides[0].kingPosition).toBe(o.sides[0].kingPosition);
          expect(c.sides[0].canCastleKingSide).toBe(o.sides[0].canCastleKingSide);
          expect(c.sides[0].canCastleQueenSide).toBe(o.sides[0].canCastleQueenSide);
        },
      );

      roundTrip(
        "rook move from A1 restores castling rights",
        (c) => {
          Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleQueenSide = true;
        },
        () => ({
          piece: { type: ROOK, color: WHITE },
          from: A1,
          to: A3,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, A1)).toBe(Board.at(o.board, A1));
          expect(Board.at(c.board, A3)).toBe(Board.at(o.board, A3));
          expect(c.sides[0].canCastleQueenSide).toBe(o.sides[0].canCastleQueenSide);
          expect(c.sides[0].canCastleKingSide).toBe(o.sides[0].canCastleKingSide);
        },
      );

      roundTrip(
        "rook move from H8 restores castling rights",
        (c) => {
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
        },
        () => ({
          piece: { type: ROOK, color: BLACK },
          from: H8,
          to: H6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, H8)).toBe(Board.at(o.board, H8));
          expect(Board.at(c.board, H6)).toBe(Board.at(o.board, H6));
          expect(c.sides[1].canCastleKingSide).toBe(o.sides[1].canCastleKingSide);
        },
      );

      roundTrip(
        "capture restores both pieces and castling rights",
        (c) => {
          Board.place(c.board, D4, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
          c.sides[0].canCastleQueenSide = true;
        },
        () => ({
          piece: { type: ROOK, color: WHITE },
          from: D4,
          to: H1,
          type: NORMAL,
          promoteTo: null,
          captured: { type: ROOK, color: WHITE },
        }),
        (o, c) => {
          expect(Board.at(c.board, D4)).toBe(Board.at(o.board, D4));
          expect(Board.at(c.board, H1)).toBe(Board.at(o.board, H1));
          expect(c.sides[0].canCastleKingSide).toBe(o.sides[0].canCastleKingSide);
        },
      );

      roundTrip(
        "en passant (white) restores both pawns and EP target",
        (c) => {
          Board.place(c.board, D5, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, E5, Square.create({ type: PAWN, color: BLACK }));
        },
        () => ({
          piece: { type: PAWN, color: WHITE },
          from: D5,
          to: E6,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        }),
        (o, c) => {
          expect(Board.at(c.board, D5)).toBe(Board.at(o.board, D5));
          expect(Board.at(c.board, E5)).toBe(Board.at(o.board, E5));
          expect(Board.at(c.board, E6)).toBe(Board.at(o.board, E6));
          expect(c.enPassantTarget).toBe(o.enPassantTarget);
        },
      );

      roundTrip(
        "en passant (black) restores both pawns",
        (c) => {
          Board.place(c.board, E4, Square.create({ type: PAWN, color: BLACK }));
          Board.place(c.board, D4, Square.create({ type: PAWN, color: WHITE }));
        },
        () => ({
          piece: { type: PAWN, color: BLACK },
          from: E4,
          to: D3,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: WHITE },
        }),
        (o, c) => {
          expect(Board.at(c.board, E4)).toBe(Board.at(o.board, E4));
          expect(Board.at(c.board, D4)).toBe(Board.at(o.board, D4));
          expect(Board.at(c.board, D3)).toBe(Board.at(o.board, D3));
        },
      );

      roundTrip(
        "en passant (A-file) restores both pawns",
        (c) => {
          Board.place(c.board, A5, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, B5, Square.create({ type: PAWN, color: BLACK }));
        },
        () => ({
          piece: { type: PAWN, color: WHITE },
          from: A5,
          to: B6,
          type: EN_PASSANT,
          promoteTo: null,
          captured: { type: PAWN, color: BLACK },
        }),
        (o, c) => {
          expect(Board.at(c.board, A5)).toBe(Board.at(o.board, A5));
          expect(Board.at(c.board, B5)).toBe(Board.at(o.board, B5));
          expect(Board.at(c.board, B6)).toBe(Board.at(o.board, B6));
        },
      );

      roundTrip(
        "promotion to queen restores pawn",
        (c) => {
          Board.place(c.board, E7, Square.create({ type: PAWN, color: WHITE }));
        },
        () => ({
          piece: { type: PAWN, color: WHITE },
          from: E7,
          to: E8,
          type: PROMOTION,
          promoteTo: QUEEN,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E7)).toBe(Board.at(o.board, E7));
          expect(Board.at(c.board, E8)).toBe(Board.at(o.board, E8));
        },
      );

      roundTrip(
        "promotion with capture restores pawn and rook",
        (c) => {
          Board.place(c.board, G7, Square.create({ type: PAWN, color: WHITE }));
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
        },
        () => ({
          piece: { type: PAWN, color: WHITE },
          from: G7,
          to: H8,
          type: PROMOTION,
          promoteTo: KNIGHT,
          captured: { type: ROOK, color: BLACK },
        }),
        (o, c) => {
          expect(Board.at(c.board, G7)).toBe(Board.at(o.board, G7));
          expect(Board.at(c.board, H8)).toBe(Board.at(o.board, H8));
        },
      );

      roundTrip(
        "castling (white king-side) restores king and rook",
        (c) => {
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleKingSide = true;
        },
        () => ({
          piece: { type: KING, color: WHITE },
          from: E1,
          to: G1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E1)).toBe(Board.at(o.board, E1));
          expect(Board.at(c.board, G1)).toBe(Board.at(o.board, G1));
          expect(Board.at(c.board, H1)).toBe(Board.at(o.board, H1));
          expect(Board.at(c.board, F1)).toBe(Board.at(o.board, F1));
          expect(c.sides[0].kingPosition).toBe(o.sides[0].kingPosition);
          expect(c.sides[0].canCastleKingSide).toBe(o.sides[0].canCastleKingSide);
        },
      );

      roundTrip(
        "castling (white queen-side) restores king and rook",
        (c) => {
          Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
          Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
          c.sides[0].kingPosition = E1;
          c.sides[0].canCastleQueenSide = true;
        },
        () => ({
          piece: { type: KING, color: WHITE },
          from: E1,
          to: C1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E1)).toBe(Board.at(o.board, E1));
          expect(Board.at(c.board, C1)).toBe(Board.at(o.board, C1));
          expect(Board.at(c.board, A1)).toBe(Board.at(o.board, A1));
          expect(Board.at(c.board, D1)).toBe(Board.at(o.board, D1));
          expect(c.sides[0].kingPosition).toBe(o.sides[0].kingPosition);
          expect(c.sides[0].canCastleQueenSide).toBe(o.sides[0].canCastleQueenSide);
        },
      );

      roundTrip(
        "castling (black king-side) restores king and rook",
        (c) => {
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          Board.place(c.board, H8, Square.create({ type: ROOK, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleKingSide = true;
        },
        () => ({
          piece: { type: KING, color: BLACK },
          from: E8,
          to: G8,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E8)).toBe(Board.at(o.board, E8));
          expect(Board.at(c.board, G8)).toBe(Board.at(o.board, G8));
          expect(Board.at(c.board, H8)).toBe(Board.at(o.board, H8));
          expect(Board.at(c.board, F8)).toBe(Board.at(o.board, F8));
          expect(c.sides[1].kingPosition).toBe(o.sides[1].kingPosition);
          expect(c.sides[1].canCastleKingSide).toBe(o.sides[1].canCastleKingSide);
        },
      );

      roundTrip(
        "castling (black queen-side) restores king and rook",
        (c) => {
          Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
          Board.place(c.board, A8, Square.create({ type: ROOK, color: BLACK }));
          c.sides[1].kingPosition = E8;
          c.sides[1].canCastleQueenSide = true;
        },
        () => ({
          piece: { type: KING, color: BLACK },
          from: E8,
          to: C8,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E8)).toBe(Board.at(o.board, E8));
          expect(Board.at(c.board, C8)).toBe(Board.at(o.board, C8));
          expect(Board.at(c.board, A8)).toBe(Board.at(o.board, A8));
          expect(Board.at(c.board, D8)).toBe(Board.at(o.board, D8));
          expect(c.sides[1].kingPosition).toBe(o.sides[1].kingPosition);
          expect(c.sides[1].canCastleQueenSide).toBe(o.sides[1].canCastleQueenSide);
        },
      );

      roundTrip(
        "double pawn push restores EP target and clocks",
        (c) => {
          Board.place(c.board, E2, Square.create({ type: PAWN, color: WHITE }));
          c.halfMoveClock = 7;
          c.fullMoveNumber = 3;
        },
        () => ({
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E2)).toBe(Board.at(o.board, E2));
          expect(Board.at(c.board, E4)).toBe(Board.at(o.board, E4));
          expect(c.enPassantTarget).toBe(o.enPassantTarget);
          expect(c.halfMoveClock).toBe(o.halfMoveClock);
          expect(c.fullMoveNumber).toBe(o.fullMoveNumber);
        },
      );

      roundTrip(
        "non-pawn move with existing EP target restores target",
        (c) => {
          Board.place(c.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
          c.enPassantTarget = D3;
        },
        () => ({
          piece: { type: KNIGHT, color: WHITE },
          from: D4,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, D4)).toBe(Board.at(o.board, D4));
          expect(Board.at(c.board, E6)).toBe(Board.at(o.board, E6));
          expect(c.enPassantTarget).toBe(o.enPassantTarget);
        },
      );

      roundTrip(
        "black pawn push restores fullMoveNumber",
        (c) => {
          Board.place(c.board, E7, Square.create({ type: PAWN, color: BLACK }));
          c.fullMoveNumber = 5;
        },
        () => ({
          piece: { type: PAWN, color: BLACK },
          from: E7,
          to: E5,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
        (o, c) => {
          expect(Board.at(c.board, E7)).toBe(Board.at(o.board, E7));
          expect(Board.at(c.board, E5)).toBe(Board.at(o.board, E5));
          expect(c.fullMoveNumber).toBe(o.fullMoveNumber);
          expect(c.halfMoveClock).toBe(o.halfMoveClock);
        },
      );
    });
  });
});
