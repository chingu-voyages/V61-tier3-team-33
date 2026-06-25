import { describe, expect, test } from "bun:test";
import {
  Piece,
  PieceColor,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  WHITE,
  BLACK,
} from "./piece";
import { RANK_1, RANK_8 } from "./position";

describe("PieceColor", () => {
  describe("opponent", () => {
    test("white → black", () => {
      expect(PieceColor.opponent(WHITE)).toBe(BLACK);
    });

    test("black → white", () => {
      expect(PieceColor.opponent(BLACK)).toBe(WHITE);
    });

    test("is its own inverse", () => {
      expect(PieceColor.opponent(PieceColor.opponent(WHITE))).toBe(WHITE);
      expect(PieceColor.opponent(PieceColor.opponent(BLACK))).toBe(BLACK);
    });
  });

  describe("kingStartRank", () => {
    test("white → rank 1", () => {
      expect(PieceColor.kingStartRank(WHITE)).toBe(RANK_1);
    });

    test("black → rank 8", () => {
      expect(PieceColor.kingStartRank(BLACK)).toBe(RANK_8);
    });
  });
});

describe("Piece", () => {
  describe("toChar", () => {
    test.each([
      [PAWN, WHITE, "P"],
      [KNIGHT, WHITE, "N"],
      [BISHOP, WHITE, "B"],
      [ROOK, WHITE, "R"],
      [QUEEN, WHITE, "Q"],
      [KING, WHITE, "K"],
    ])("white %i → uppercase '%s'", (type, color, expected) => {
      expect(Piece.toChar({ type, color })).toBe(expected);
    });

    test.each([
      [PAWN, BLACK, "p"],
      [KNIGHT, BLACK, "n"],
      [BISHOP, BLACK, "b"],
      [ROOK, BLACK, "r"],
      [QUEEN, BLACK, "q"],
      [KING, BLACK, "k"],
    ])("black %i → lowercase '%s'", (type, color, expected) => {
      expect(Piece.toChar({ type, color })).toBe(expected);
    });
  });

  describe("parse", () => {
    test.each([
      ["P", { type: PAWN, color: WHITE }],
      ["N", { type: KNIGHT, color: WHITE }],
      ["B", { type: BISHOP, color: WHITE }],
      ["R", { type: ROOK, color: WHITE }],
      ["Q", { type: QUEEN, color: WHITE }],
      ["K", { type: KING, color: WHITE }],
    ])("uppercase '%s' → white piece", (letter, expected) => {
      expect(Piece.parse(letter)).toEqual(expected);
    });

    test.each([
      ["p", { type: PAWN, color: BLACK }],
      ["n", { type: KNIGHT, color: BLACK }],
      ["b", { type: BISHOP, color: BLACK }],
      ["r", { type: ROOK, color: BLACK }],
      ["q", { type: QUEEN, color: BLACK }],
      ["k", { type: KING, color: BLACK }],
    ])("lowercase '%s' → black piece", (letter, expected) => {
      expect(Piece.parse(letter)).toEqual(expected);
    });

    test("invalid letter → null", () => expect(Piece.parse("X")).toBeNull());
    test("digit → null", () => expect(Piece.parse("1")).toBeNull());
    test("empty string → null", () => expect(Piece.parse("")).toBeNull());
    test("multi-char → null", () => expect(Piece.parse("PP")).toBeNull());

    test("round-trips toChar for all pieces", () => {
      const types = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING];
      const colors = [WHITE, BLACK];
      for (const type of types) {
        for (const color of colors) {
          const piece = { type, color };
          expect(Piece.parse(Piece.toChar(piece))).toEqual(piece);
        }
      }
    });
  });
});
