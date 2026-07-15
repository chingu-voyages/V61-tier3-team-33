import { describe, expect, test } from "bun:test";

import { Snapshot } from "./history";
import { EN_PASSANT, NORMAL } from "./move";
import { BLACK, KNIGHT, PAWN, WHITE } from "./piece";
import { A1, D6, E2, E4, E5, NO_POSITION } from "./position";
import { SideState, TurnContext } from "./state";

describe("Snapshot", () => {
  describe("create", () => {
    const move = {
      piece: { type: PAWN, color: WHITE },
      from: E2,
      to: E4,
      type: NORMAL,
      promoteTo: null,
      captured: null,
    };

    test("carries the move through unchanged", () => {
      const ctx = TurnContext.create();
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.move).toBe(move);
    });

    test("captures enPassantTarget from the context", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = E4;
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.previousEnPassantTarget).toBe(E4);
    });

    test("captures NO_POSITION when no en passant target", () => {
      const ctx = TurnContext.create();
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.previousEnPassantTarget).toBe(NO_POSITION);
    });

    test("captures halfMoveClock from the context", () => {
      const ctx = TurnContext.create();
      ctx.halfMoveClock = 12;
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.previousHalfMoveClock).toBe(12);
    });

    test("captures fullMoveNumber from the context", () => {
      const ctx = TurnContext.create();
      ctx.fullMoveNumber = 7;
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.previousFullMoveNumber).toBe(7);
    });

    test("captures a copy of both sides' state", () => {
      const ctx = TurnContext.create();
      ctx.sides[0] = {
        kingPosition: E2,
        canCastleKingSide: true,
        canCastleQueenSide: false,
      };
      ctx.sides[1] = {
        kingPosition: E5,
        canCastleKingSide: false,
        canCastleQueenSide: true,
      };
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.previousSides[0]).toEqual(ctx.sides[0]);
      expect(snapshot.previousSides[1]).toEqual(ctx.sides[1]);
    });

    test("side copies are independent of the context (mutating ctx afterwards does not change the snapshot)", () => {
      const ctx = TurnContext.create();
      ctx.sides[0].canCastleKingSide = true;
      ctx.sides[1].kingPosition = E5;
      const snapshot = Snapshot.create(ctx, move);
      ctx.sides[0].canCastleKingSide = false;
      ctx.sides[1].kingPosition = E4;
      expect(snapshot.previousSides[0].canCastleKingSide).toBe(true);
      expect(snapshot.previousSides[1].kingPosition).toBe(E5);
    });

    test("returns a snapshot whose fields match a freshly-built expected object", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = E4;
      ctx.halfMoveClock = 3;
      ctx.fullMoveNumber = 9;
      ctx.sides[0] = {
        kingPosition: A1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot).toEqual({
        move,
        previousSides: [ctx.sides[0], ctx.sides[1]],
        previousEnPassantTarget: E4,
        previousHalfMoveClock: 3,
        previousFullMoveNumber: 9,
      });
    });

    test("works with an en passant move", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = D6;
      const enPassantMove = {
        piece: { type: PAWN, color: WHITE },
        from: E5,
        to: D6,
        type: EN_PASSANT,
        promoteTo: null,
        captured: { type: PAWN, color: BLACK },
      };
      const snapshot = Snapshot.create(ctx, enPassantMove);
      expect(snapshot.move).toBe(enPassantMove);
      expect(snapshot.previousEnPassantTarget).toBe(D6);
    });

    test("works with a non-pawn move", () => {
      const ctx = TurnContext.create();
      const knightMove = {
        piece: { type: KNIGHT, color: WHITE },
        from: A1,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };
      const snapshot = Snapshot.create(ctx, knightMove);
      expect(snapshot.move).toBe(knightMove);
    });

    test("default-ctx snapshot has sensible zero/empty defaults", () => {
      const ctx = TurnContext.create();
      const snapshot = Snapshot.create(ctx, move);
      expect(snapshot.previousEnPassantTarget).toBe(NO_POSITION);
      expect(snapshot.previousHalfMoveClock).toBe(0);
      expect(snapshot.previousFullMoveNumber).toBe(0);
      expect(snapshot.previousSides[0]).toEqual(SideState.empty());
      expect(snapshot.previousSides[1]).toEqual(SideState.empty());
    });
  });
});
