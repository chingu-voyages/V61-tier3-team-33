import { describe, test, expect } from "bun:test";

import type { Move } from "../core/move";
import type { Position } from "../core/position";
import type { TurnContext } from "../core/state";

import { NORMAL, CASTLING, EN_PASSANT, PROMOTION } from "../core/move";
import {
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  WHITE,
  BLACK,
} from "../core/piece";
import { Board, Square } from "../core/board";
import {
  A1,
  A2,
  A4,
  C1,
  C3,
  C8,
  D1,
  D4,
  D5,
  D6,
  D7,
  D8,
  E1,
  E2,
  E4,
  E5,
  E7,
  E8,
  F3,
  G1,
  G8,
  H1,
  H5,
  H8,
} from "../core/position";
import { TurnContext as TC } from "../core/state";
import { getDefaultEngine } from "../engine/default";

import { San, SAN } from "./san";

describe("SAN", () => {
  const san = new San();

  /**
   * Builds a TurnContext with white and black kings placed (required by the
   * engine for legality/check filtering during disambiguation), then lets
   * the caller add any other pieces.
   */
  function ctxWithKings(
    whiteKing: Position,
    blackKing: Position,
    sideToMove: typeof WHITE | typeof BLACK,
    init: (board: Board) => void,
  ): TurnContext {
    const ctx = TC.create();
    Board.place(
      ctx.board,
      whiteKing,
      Square.create({ type: KING, color: WHITE }),
    );
    Board.place(
      ctx.board,
      blackKing,
      Square.create({ type: KING, color: BLACK }),
    );
    ctx.sides[0].kingPosition = whiteKing;
    ctx.sides[1].kingPosition = blackKing;
    ctx.sideToMove = sideToMove;
    init(ctx.board);
    return ctx;
  }

  function move(overrides: Partial<Move>): Move {
    return {
      piece: { type: PAWN, color: WHITE },
      from: E2,
      to: E4,
      type: NORMAL,
      promoteTo: null,
      captured: null,
      ...overrides,
    };
  }

  describe("pawn moves", () => {
    test("a quiet pawn push encodes as just the destination square", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E4,
      });
      expect(san.encode(m, ctx, false, false)).toBe("e4");
    });

    test("a pawn capture is prefixed with the origin file and 'x'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E4,
        to: D5,
        captured: { type: PAWN, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("exd5");
    });

    test("an en passant capture is encoded like any other pawn capture", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E5,
        to: D6,
        type: EN_PASSANT,
        captured: { type: PAWN, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("exd6");
    });

    test("pawns never carry a piece letter", () => {
      const ctx = TC.create();
      const quiet = move({
        piece: { type: PAWN, color: WHITE },
        from: A2,
        to: A4,
      });
      expect(san.encode(quiet, ctx, false, false)).toBe("a4");
    });
  });

  describe("piece moves", () => {
    test("a knight move is prefixed with 'N'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Nf3");
    });

    test("a bishop move is prefixed with 'B'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: BISHOP, color: WHITE },
        from: C1,
        to: H5,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Bh5");
    });

    test("a rook move is prefixed with 'R'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: ROOK, color: WHITE },
        from: A1,
        to: A4,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Ra4");
    });

    test("a queen move is prefixed with 'Q'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: QUEEN, color: WHITE },
        from: D1,
        to: H5,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Qh5");
    });

    test("a king move is prefixed with 'K'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: WHITE },
        from: E1,
        to: E2,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Ke2");
    });

    test("a piece capture is 'x' with no origin file (when unambiguous)", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
        captured: { type: PAWN, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("Nxf3");
    });
  });

  describe("castling", () => {
    test("a king moving toward the h-file encodes as king-side castling", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: WHITE },
        from: E1,
        to: G1,
        type: CASTLING,
      });
      expect(san.encode(m, ctx, false, false)).toBe("O-O");
    });

    test("a king moving toward the a-file encodes as queen-side castling", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: WHITE },
        from: E1,
        to: C1,
        type: CASTLING,
      });
      expect(san.encode(m, ctx, false, false)).toBe("O-O-O");
    });

    test("black king-side castling also uses O-O", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: BLACK },
        from: E8,
        to: G8,
        type: CASTLING,
      });
      expect(san.encode(m, ctx, false, false)).toBe("O-O");
    });

    test("black queen-side castling also uses O-O-O", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: BLACK },
        from: E8,
        to: C8,
        type: CASTLING,
      });
      expect(san.encode(m, ctx, false, false)).toBe("O-O-O");
    });

    test("castling that delivers check appends '+'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: WHITE },
        from: E1,
        to: G1,
        type: CASTLING,
      });
      expect(san.encode(m, ctx, true, false)).toBe("O-O+");
    });

    test("castling that delivers checkmate appends '#'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: WHITE },
        from: E1,
        to: C1,
        type: CASTLING,
      });
      expect(san.encode(m, ctx, true, true)).toBe("O-O-O#");
    });

    test("castling ignores any captured value on the move", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: KING, color: WHITE },
        from: E1,
        to: G1,
        type: CASTLING,
        captured: { type: ROOK, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("O-O");
    });
  });

  describe("promotion", () => {
    test("a quiet promotion appends '=' and the promoted piece letter", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: E8,
        type: PROMOTION,
        promoteTo: QUEEN,
      });
      expect(san.encode(m, ctx, false, false)).toBe("e8=Q");
    });

    test("a capturing promotion combines the capture and promotion notation", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: D7,
        to: E8,
        type: PROMOTION,
        promoteTo: QUEEN,
        captured: { type: ROOK, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("dxe8=Q");
    });

    test("underpromotion to a knight uses '=N'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: E8,
        type: PROMOTION,
        promoteTo: KNIGHT,
      });
      expect(san.encode(m, ctx, false, false)).toBe("e8=N");
    });

    test("underpromotion to a rook or bishop uses '=R' / '=B'", () => {
      const ctx = TC.create();
      const toRook = move({
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: E8,
        type: PROMOTION,
        promoteTo: ROOK,
      });
      const toBishop = move({
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: E8,
        type: PROMOTION,
        promoteTo: BISHOP,
      });
      expect(san.encode(toRook, ctx, false, false)).toBe("e8=R");
      expect(san.encode(toBishop, ctx, false, false)).toBe("e8=B");
    });

    test("a checkmating promotion appends '#' after the promoted piece letter", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: E8,
        type: PROMOTION,
        promoteTo: QUEEN,
      });
      expect(san.encode(m, ctx, true, true)).toBe("e8=Q#");
    });
  });

  describe("check and checkmate suffixes", () => {
    test("a move with neither flag set has no suffix", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: QUEEN, color: WHITE },
        from: D1,
        to: H5,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Qh5");
    });

    test("a checking move appends '+'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: QUEEN, color: WHITE },
        from: D1,
        to: H5,
      });
      expect(san.encode(m, ctx, true, false)).toBe("Qh5+");
    });

    test("a checkmating move appends '#' instead of '+'", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: QUEEN, color: WHITE },
        from: D1,
        to: H5,
      });
      expect(san.encode(m, ctx, true, true)).toBe("Qh5#");
    });

    test("checkmate takes priority even if isCheck is somehow false", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: QUEEN, color: WHITE },
        from: D1,
        to: H5,
      });
      expect(san.encode(m, ctx, false, true)).toBe("Qh5#");
    });
  });

  describe("disambiguation", () => {
    test("no disambiguation is added when only one piece can reach the square", () => {
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, G1, Square.create({ type: KNIGHT, color: WHITE }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Nf3");
    });

    test("two same-type pieces on different files disambiguate by file", () => {
      // White knights on g1 and c1 can both legally reach e2.
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, G1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, C1, Square.create({ type: KNIGHT, color: WHITE }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: E2,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Nge2");
    });

    test("the other ambiguous piece disambiguates by its own file", () => {
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, G1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, C1, Square.create({ type: KNIGHT, color: WHITE }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: C1,
        to: E2,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Nce2");
    });

    test("two same-type pieces sharing a file disambiguate by rank", () => {
      // White knights on d1 and d5 can both legally reach c3.
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, D1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, D5, Square.create({ type: KNIGHT, color: WHITE }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: D1,
        to: C3,
      });
      expect(san.encode(m, ctx, false, false)).toBe("N1c3");
    });

    test("a capture combines disambiguation with the 'x' capture marker", () => {
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, G1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, C1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, E2, Square.create({ type: PAWN, color: BLACK }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: E2,
        captured: { type: PAWN, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("Ngxe2");
    });

    test("when both file and rank are shared, the full origin square is used", () => {
      // White knights on a4, a2, and e4 can all legally reach c3.
      // a2 shares a4's file; e4 shares a4's rank.
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, A4, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, A2, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, E4, Square.create({ type: KNIGHT, color: WHITE }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: A4,
        to: C3,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Na4c3");
    });

    test("pieces of a different type reaching the same square do not cause disambiguation", () => {
      // A bishop and a knight can both reach the same square, but they are
      // different piece types, so no disambiguator is needed for either.
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, G1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(board, H5, Square.create({ type: BISHOP, color: WHITE }));
      });
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Nf3");
    });

    test("pawns are never disambiguated even when they could reach the same square as another piece", () => {
      const ctx = ctxWithKings(H1, H8, WHITE, (board) => {
        Board.place(board, D4, Square.create({ type: PAWN, color: WHITE }));
        Board.place(board, E5, Square.create({ type: PAWN, color: BLACK }));
      });
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: D4,
        to: E5,
        captured: { type: PAWN, color: BLACK },
      });
      expect(san.encode(m, ctx, false, false)).toBe("dxe5");
    });

    test("a pinned piece that cannot legally reach the square does not force disambiguation", () => {
      // The white rook on d1 is pinned to the king on d5 by the black rook
      // on d8 along the d-file, so it cannot legally move to a4. Only the
      // rook starting on a1 can actually reach a4.
      const ctx = ctxWithKings(D5, H8, WHITE, (board) => {
        Board.place(board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(board, D1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(board, D8, Square.create({ type: ROOK, color: BLACK }));
      });
      const m = move({
        piece: { type: ROOK, color: WHITE },
        from: A1,
        to: A4,
      });
      expect(san.encode(m, ctx, false, false)).toBe("Ra4");
    });
  });

  describe("construction", () => {
    test("San defaults to the shared default engine when no engine is supplied", () => {
      const defaultSan = new San();
      const ctx = TC.create();
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
      });
      expect(defaultSan.encode(m, ctx, false, false)).toBe("Nf3");
    });

    test("San accepts an explicit engine", () => {
      const explicitSan = new San(getDefaultEngine());
      const ctx = TC.create();
      const m = move({
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
      });
      expect(explicitSan.encode(m, ctx, false, false)).toBe("Nf3");
    });

    test("the exported SAN singleton encodes moves the same way", () => {
      const ctx = TC.create();
      const m = move({
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E4,
      });
      expect(SAN.encode(m, ctx, false, false)).toBe("e4");
    });
  });
});
