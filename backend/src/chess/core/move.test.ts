import { describe, expect, test } from "bun:test";
import { Move, NORMAL, CASTLING, EN_PASSANT } from "./move";
import { KNIGHT, PAWN, ROOK, QUEEN, WHITE, BLACK } from "./piece";
import {
  A1,
  A8,
  C1,
  C8,
  D1,
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
  F1,
  F8,
  G1,
  G8,
  H1,
  H8,
} from "./position";

describe("Move", () => {
  describe("isDoublePawnPush", () => {
    test("white pawn two squares forward → true", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(true));

    test("black pawn two squares forward → true", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: PAWN, color: BLACK },
          from: E7,
          to: E5,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(true));

    test("white pawn one square forward → false", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E3,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(false));

    test("black pawn one square forward → false", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: PAWN, color: BLACK },
          from: E7,
          to: E6,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(false));

    test("white pawn moving backward → false", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: PAWN, color: WHITE },
          from: E4,
          to: E2,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(false));

    test("black pawn moving backward → false", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: PAWN, color: BLACK },
          from: E5,
          to: E7,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(false));

    test("non-pawn moving two squares → false", () =>
      expect(
        Move.isDoublePawnPush({
          piece: { type: ROOK, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(false));
  });

  describe("enPassantTarget", () => {
    test("white pawn e2→e4: target is e3", () =>
      expect(
        Move.enPassantTarget({
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(E3));

    test("black pawn e7→e5: target is e6", () =>
      expect(
        Move.enPassantTarget({
          piece: { type: PAWN, color: BLACK },
          from: E7,
          to: E5,
          type: NORMAL,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(E6));
  });

  describe("enPassantCapturedPosition", () => {
    test("white pawn e5→d6: captured pawn was on d5", () =>
      expect(
        Move.enPassantCapturedPosition({
          piece: { type: PAWN, color: WHITE },
          from: E5,
          to: D6,
          type: EN_PASSANT,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(D5));

    test("black pawn d4→e3: captured pawn was on e4", () =>
      expect(
        Move.enPassantCapturedPosition({
          piece: { type: PAWN, color: BLACK },
          from: D4,
          to: E3,
          type: EN_PASSANT,
          promoteTo: null,
          captured: null,
        }),
      ).toBe(E4));
  });

  describe("castlingRookPositions", () => {
    test("white king-side (e1→g1): rook h1→f1", () =>
      expect(
        Move.castlingRookPositions({
          piece: { type: ROOK, color: WHITE },
          from: E1,
          to: G1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
      ).toEqual([H1, F1]));

    test("white queen-side (e1→c1): rook a1→d1", () =>
      expect(
        Move.castlingRookPositions({
          piece: { type: ROOK, color: WHITE },
          from: E1,
          to: C1,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
      ).toEqual([A1, D1]));

    test("black king-side (e8→g8): rook h8→f8", () =>
      expect(
        Move.castlingRookPositions({
          piece: { type: ROOK, color: BLACK },
          from: E8,
          to: G8,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
      ).toEqual([H8, F8]));

    test("black queen-side (e8→c8): rook a8→d8", () =>
      expect(
        Move.castlingRookPositions({
          piece: { type: ROOK, color: BLACK },
          from: E8,
          to: C8,
          type: CASTLING,
          promoteTo: null,
          captured: null,
        }),
      ).toEqual([A8, D8]));
  });

  describe("isEqual", () => {
    const base = {
      piece: { type: ROOK, color: WHITE },
      from: E1,
      to: E4,
      type: NORMAL,
      promoteTo: null,
      captured: null,
    };

    test("identical moves → true", () =>
      expect(Move.isEqual(base, { ...base })).toBe(true));

    test("different `from` → false", () =>
      expect(Move.isEqual(base, { ...base, from: E2 })).toBe(false));

    test("different `to` → false", () =>
      expect(Move.isEqual(base, { ...base, to: E5 })).toBe(false));

    test("different `type` → false", () =>
      expect(Move.isEqual(base, { ...base, type: CASTLING })).toBe(false));

    test("different `piece.type` → false", () =>
      expect(
        Move.isEqual(base, { ...base, piece: { type: KNIGHT, color: WHITE } }),
      ).toBe(false));

    test("different `captured` → false", () =>
      expect(
        Move.isEqual(base, {
          ...base,
          captured: { type: ROOK, color: BLACK },
        }),
      ).toBe(false));

    test("different `promoteTo` → false", () =>
      expect(Move.isEqual(base, { ...base, promoteTo: QUEEN })).toBe(false));
  });
});
