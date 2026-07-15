import { describe, expect, test } from "bun:test";

import { Board, EMPTY_SQUARE, Square } from "./board";
import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "./piece";
import { A1, E4, H8, Position } from "./position";

describe("Square", () => {
  const whitePawn = Square.create({ type: PAWN, color: WHITE });
  const blackPawn = Square.create({ type: PAWN, color: BLACK });
  const whiteKing = Square.create({ type: KING, color: WHITE });
  const blackKing = Square.create({ type: KING, color: BLACK });

  describe("create", () => {
    test("white pawn → 1", () => expect(whitePawn).toBe(Square.create({ type: PAWN, color: WHITE })));
    test("white king → 6", () => expect(whiteKing).toBe(Square.create({ type: KING, color: WHITE })));
    test("black pawn → 7", () => expect(blackPawn).toBe(Square.create({ type: PAWN, color: BLACK })));
    test("black king → 12", () => expect(blackKing).toBe(Square.create({ type: KING, color: BLACK })));

    test("absolute byte encoding", () => {
      expect(Square.create({ type: PAWN, color: WHITE })).toBe(Square(1));
      expect(Square.create({ type: KNIGHT, color: WHITE })).toBe(Square(2));
      expect(Square.create({ type: BISHOP, color: WHITE })).toBe(Square(3));
      expect(Square.create({ type: ROOK, color: WHITE })).toBe(Square(4));
      expect(Square.create({ type: QUEEN, color: WHITE })).toBe(Square(5));
      expect(Square.create({ type: KING, color: WHITE })).toBe(Square(6));
      expect(Square.create({ type: PAWN, color: BLACK })).toBe(Square(7));
      expect(Square.create({ type: KING, color: BLACK })).toBe(Square(12));
    });
  });

  describe("isEmpty / isOccupied", () => {
    test("empty square is empty", () => {
      expect(Square.isEmpty(EMPTY_SQUARE)).toBe(true);
      expect(Square.isOccupied(EMPTY_SQUARE)).toBe(false);
    });

    test("white piece is occupied", () => {
      expect(Square.isEmpty(whitePawn)).toBe(false);
      expect(Square.isOccupied(whitePawn)).toBe(true);
    });

    test("black piece is occupied", () => {
      expect(Square.isEmpty(blackKing)).toBe(false);
      expect(Square.isOccupied(blackKing)).toBe(true);
    });
  });

  describe("isOccupiedBy", () => {
    test("empty square → false for either color", () => {
      expect(Square.isOccupiedBy(EMPTY_SQUARE, WHITE)).toBe(false);
      expect(Square.isOccupiedBy(EMPTY_SQUARE, BLACK)).toBe(false);
    });

    test("white piece → true for white, false for black", () => {
      expect(Square.isOccupiedBy(whitePawn, WHITE)).toBe(true);
      expect(Square.isOccupiedBy(whitePawn, BLACK)).toBe(false);
    });

    test("black piece → false for white, true for black", () => {
      expect(Square.isOccupiedBy(blackPawn, WHITE)).toBe(false);
      expect(Square.isOccupiedBy(blackPawn, BLACK)).toBe(true);
    });

    test("white king is white", () => expect(Square.isOccupiedBy(whiteKing, WHITE)).toBe(true));
    test("black king is black", () => expect(Square.isOccupiedBy(blackKing, BLACK)).toBe(true));
  });

  describe("isOccupiedByAny", () => {
    const whitePawn = Square.create({ type: PAWN, color: WHITE });
    const whiteRook = Square.create({ type: ROOK, color: WHITE });
    const blackKing = Square.create({ type: KING, color: BLACK });

    test("empty square → false regardless of color or types", () => {
      expect(Square.isOccupiedByAny(EMPTY_SQUARE, WHITE, PAWN)).toBe(false);
      expect(Square.isOccupiedByAny(EMPTY_SQUARE, WHITE, PAWN, KING)).toBe(false);
      expect(Square.isOccupiedByAny(EMPTY_SQUARE, BLACK, ROOK)).toBe(false);
    });

    test("white pawn → true for (WHITE, PAWN), false for (WHITE, ROOK)", () => {
      expect(Square.isOccupiedByAny(whitePawn, WHITE, PAWN)).toBe(true);
      expect(Square.isOccupiedByAny(whitePawn, WHITE, ROOK)).toBe(false);
    });

    test("white pawn → true when multiple types include PAWN", () => {
      expect(Square.isOccupiedByAny(whitePawn, WHITE, KNIGHT, PAWN, KING)).toBe(true);
    });

    test("white pawn → false for wrong color (BLACK, PAWN)", () => {
      expect(Square.isOccupiedByAny(whitePawn, BLACK, PAWN)).toBe(false);
    });

    test("white rook → true for (WHITE, ROOK), false for (WHITE, PAWN)", () => {
      expect(Square.isOccupiedByAny(whiteRook, WHITE, ROOK)).toBe(true);
      expect(Square.isOccupiedByAny(whiteRook, WHITE, PAWN)).toBe(false);
    });

    test("black king → true for (BLACK, KING), false for (BLACK, PAWN)", () => {
      expect(Square.isOccupiedByAny(blackKing, BLACK, KING)).toBe(true);
      expect(Square.isOccupiedByAny(blackKing, BLACK, PAWN)).toBe(false);
    });

    test("black king → false for wrong color (WHITE, KING)", () => {
      expect(Square.isOccupiedByAny(blackKing, WHITE, KING)).toBe(false);
    });

    test("single type arg works (not variadic)", () => {
      expect(Square.isOccupiedByAny(whitePawn, WHITE, PAWN)).toBe(true);
      expect(Square.isOccupiedByAny(whitePawn, WHITE, ROOK)).toBe(false);
    });
  });

  describe("isOccupiedByAnyPiece", () => {
    const whitePawn = Square.create({ type: PAWN, color: WHITE });
    const whiteRook = Square.create({ type: ROOK, color: WHITE });
    const blackPawn = Square.create({ type: PAWN, color: BLACK });
    const blackKing = Square.create({ type: KING, color: BLACK });

    test("empty square → false for any type", () => {
      expect(Square.isOccupiedByAnyPiece(EMPTY_SQUARE, PAWN)).toBe(false);
      expect(Square.isOccupiedByAnyPiece(EMPTY_SQUARE, PAWN, KING, ROOK)).toBe(false);
    });

    test("white pawn → true for PAWN, false for ROOK", () => {
      expect(Square.isOccupiedByAnyPiece(whitePawn, PAWN)).toBe(true);
      expect(Square.isOccupiedByAnyPiece(whitePawn, ROOK)).toBe(false);
    });

    test("black pawn → true for PAWN, false for ROOK", () => {
      expect(Square.isOccupiedByAnyPiece(blackPawn, PAWN)).toBe(true);
      expect(Square.isOccupiedByAnyPiece(blackPawn, ROOK)).toBe(false);
    });

    test("black king → true for KING, false for PAWN", () => {
      expect(Square.isOccupiedByAnyPiece(blackKing, KING)).toBe(true);
      expect(Square.isOccupiedByAnyPiece(blackKing, PAWN)).toBe(false);
    });

    test("white rook → true when multiple types include ROOK", () => {
      expect(Square.isOccupiedByAnyPiece(whiteRook, KNIGHT, ROOK, QUEEN)).toBe(true);
    });

    test("white rook → false when no types match", () => {
      expect(Square.isOccupiedByAnyPiece(whiteRook, PAWN, KNIGHT, BISHOP)).toBe(false);
    });

    test("single type arg works (not variadic)", () => {
      expect(Square.isOccupiedByAnyPiece(whitePawn, PAWN)).toBe(true);
      expect(Square.isOccupiedByAnyPiece(whitePawn, ROOK)).toBe(false);
    });

    test("all 6 piece types work for both colors", () => {
      const types = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING] as const;
      for (const type of types) {
        const ws = Square.create({ type, color: WHITE });
        const bs = Square.create({ type, color: BLACK });
        expect(Square.isOccupiedByAnyPiece(ws, type)).toBe(true);
        expect(Square.isOccupiedByAnyPiece(bs, type)).toBe(true);
      }
    });
  });

  describe("pieceType", () => {
    test("white pawn → PAWN", () => expect(Square.pieceType(whitePawn)).toBe(PAWN));
    test("white king → KING", () => expect(Square.pieceType(whiteKing)).toBe(KING));
    test("black pawn → PAWN", () => expect(Square.pieceType(blackPawn)).toBe(PAWN));
    test("black king → KING", () => expect(Square.pieceType(blackKing)).toBe(KING));

    test("white and black same type share pieceType", () => {
      const types = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING];
      for (const type of types) {
        const w = Square.create({ type, color: WHITE });
        const b = Square.create({ type, color: BLACK });
        expect(Square.pieceType(w)).toBe(Square.pieceType(b));
      }
    });
  });

  describe("pieceColor", () => {
    test("white pieces are white", () => {
      expect(Square.pieceColor(whitePawn)).toBe(WHITE);
      expect(Square.pieceColor(whiteKing)).toBe(WHITE);
    });

    test("black pieces are black", () => {
      expect(Square.pieceColor(blackPawn)).toBe(BLACK);
      expect(Square.pieceColor(blackKing)).toBe(BLACK);
    });
  });
});

describe("Board", () => {
  describe("create", () => {
    test("returns a Board of length 64", () => {
      expect(Board.create()).toHaveLength(64);
    });

    test("all squares are empty", () => {
      const board = Board.create();
      expect(board.every((s) => s === EMPTY_SQUARE)).toBe(true);
    });
  });

  describe("copy", () => {
    const whitePawn = Square.create({ type: PAWN, color: WHITE });
    const blackKing = Square.create({ type: KING, color: BLACK });

    test("copy has the same length as the original", () => {
      const board = Board.create();
      expect(Board.copy(board)).toHaveLength(64);
    });

    test("copy preserves all placed pieces", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      Board.place(board, H8, blackKing);
      const copy = Board.copy(board);
      expect(copy[A1]).toBe(whitePawn);
      expect(copy[H8]).toBe(blackKing);
    });

    test("copy is independent — mutating the original does not affect the copy", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      const copy = Board.copy(board);
      Board.clear(board, A1);
      expect(copy[A1]).toBe(whitePawn);
      expect(board[A1]).toBe(EMPTY_SQUARE);
    });

    test("copy is independent — mutating the copy does not affect the original", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      const copy = Board.copy(board);
      Board.place(copy, E4, blackKing);
      expect(board[E4]).toBe(EMPTY_SQUARE);
      expect(copy[E4]).toBe(blackKing);
    });

    test("copy of an empty board is all empty", () => {
      const copy = Board.copy(Board.create());
      expect(copy.every((s) => s === EMPTY_SQUARE)).toBe(true);
    });
  });

  describe("place", () => {
    const whitePawn = Square.create({ type: PAWN, color: WHITE });
    const blackKing = Square.create({ type: KING, color: BLACK });

    test("places a square at the given position", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      expect(board[A1]).toBe(whitePawn);
    });

    test("overwrites an existing piece", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      Board.place(board, A1, blackKing);
      expect(board[A1]).toBe(blackKing);
    });
  });

  describe("clear", () => {
    test("empties an occupied square", () => {
      const board = Board.create();
      const whitePawn = Square.create({ type: PAWN, color: WHITE });
      Board.place(board, A1, whitePawn);
      Board.clear(board, A1);
      expect(board[A1]).toBe(EMPTY_SQUARE);
    });

    test("clearing an already-empty square is a no-op", () => {
      const board = Board.create();
      Board.clear(board, E4);
      expect(board[E4]).toBe(EMPTY_SQUARE);
    });
  });

  describe("move", () => {
    const whitePawn = Square.create({ type: PAWN, color: WHITE });
    const blackPawn = Square.create({ type: PAWN, color: BLACK });

    test("piece arrives at destination", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      Board.move(board, A1, E4);
      expect(board[E4]).toBe(whitePawn);
    });

    test("source square is emptied", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      Board.move(board, A1, E4);
      expect(board[A1]).toBe(EMPTY_SQUARE);
    });

    test("captures: destination piece is overwritten", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      Board.place(board, E4, blackPawn);
      Board.move(board, A1, E4);
      expect(board[E4]).toBe(whitePawn);
      expect(board[A1]).toBe(EMPTY_SQUARE);
    });

    test("self-move empties the square", () => {
      const board = Board.create();
      Board.place(board, A1, whitePawn);
      Board.move(board, A1, A1);
      expect(board[A1]).toBe(EMPTY_SQUARE);
    });
  });

  describe("isOccupiedAt", () => {
    const blackKing = Square.create({ type: KING, color: BLACK });

    test("fresh board → all squares unoccupied", () => {
      const board = Board.create();
      for (let pos = 0; pos < 64; pos++) {
        expect(Board.isOccupiedAt(board, Position(pos))).toBe(false);
      }
    });

    test("occupied after place", () => {
      const board = Board.create();
      Board.place(board, H8, blackKing);
      expect(Board.isOccupiedAt(board, H8)).toBe(true);
    });

    test("unoccupied after clear", () => {
      const board = Board.create();
      Board.place(board, H8, blackKing);
      Board.clear(board, H8);
      expect(Board.isOccupiedAt(board, H8)).toBe(false);
    });
  });
});
