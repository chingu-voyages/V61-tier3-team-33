import { describe, expect, test } from "bun:test";
import { MoveHash } from "./hash";
import { Snapshot } from "./history";
import { NORMAL } from "./move";
import { PAWN, WHITE, BLACK } from "./piece";
import { E2, E4, NO_POSITION } from "./position";
import { SideState, TurnContext } from "./state";

describe("MoveHash", () => {
  describe("create", () => {
    const move = {
      piece: { type: PAWN, color: WHITE },
      from: E2,
      to: E4,
      type: NORMAL,
      promoteTo: null,
      captured: null,
    };

    /** Builds a minimal pre-move snapshot from a TurnContext. */
    const snapshotFrom = (ctx: TurnContext) => Snapshot.create(ctx, move);

    test("carries the move through unchanged", () => {
      const ctx = TurnContext.create();
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.move).toBe(move);
    });

    test("previousEnPassantTarget matches the snapshot", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = E4;
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.previousEnPassantTarget).toBe(E4);
    });

    test("previousSides matches the snapshot's previousSides", () => {
      const ctx = TurnContext.create();
      ctx.sides[0] = {
        kingPosition: E2,
        canCastleKingSide: true,
        canCastleQueenSide: false,
      };
      ctx.sides[1] = {
        kingPosition: E4,
        canCastleKingSide: false,
        canCastleQueenSide: true,
      };
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.previousSides[0]).toEqual(snapshot.previousSides[0]);
      expect(moveHash.previousSides[1]).toEqual(snapshot.previousSides[1]);
    });

    test("newSides reflects the post-move context", () => {
      const ctx = TurnContext.create();
      ctx.sides[0] = {
        kingPosition: E2,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      ctx.sides[1] = {
        kingPosition: E4,
        canCastleKingSide: false,
        canCastleQueenSide: false,
      };
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.newSides[0]).toEqual(ctx.sides[0]);
      expect(moveHash.newSides[1]).toEqual(ctx.sides[1]);
    });

    test("newSides are independent copies — mutating ctx afterwards does not change them", () => {
      const ctx = TurnContext.create();
      ctx.sides[0].canCastleKingSide = true;
      ctx.sides[1].kingPosition = E4;
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      ctx.sides[0].canCastleKingSide = false;
      ctx.sides[1].kingPosition = E2;
      expect(moveHash.newSides[0].canCastleKingSide).toBe(true);
      expect(moveHash.newSides[1].kingPosition).toBe(E4);
    });

    test("previousSides are the same references as the snapshot's (no extra copy)", () => {
      const ctx = TurnContext.create();
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.previousSides[0]).toBe(snapshot.previousSides[0]);
      expect(moveHash.previousSides[1]).toBe(snapshot.previousSides[1]);
    });

    test("previousSides still reflect the pre-move state when ctx has since changed", () => {
      const ctx = TurnContext.create();
      ctx.sides[0].canCastleKingSide = true;
      const snapshot = snapshotFrom(ctx);
      // Simulate the move having already happened — context mutated.
      ctx.sides[0].canCastleKingSide = false;
      ctx.enPassantTarget = E4;
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.previousSides[0].canCastleKingSide).toBe(true);
      expect(moveHash.previousEnPassantTarget).toBe(NO_POSITION);
    });

    test("newSides are independent of each other (two separate SideState objects)", () => {
      const ctx = TurnContext.create();
      ctx.sides[0] = {
        kingPosition: E2,
        canCastleKingSide: true,
        canCastleQueenSide: false,
      };
      ctx.sides[1] = {
        kingPosition: E4,
        canCastleKingSide: false,
        canCastleQueenSide: true,
      };
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.newSides[0]).not.toBe(moveHash.newSides[1]);
      expect(moveHash.newSides[0].canCastleKingSide).toBe(true);
      expect(moveHash.newSides[1].canCastleQueenSide).toBe(true);
    });

    test("default-ctx MoveHash has empty/zero-valued sides", () => {
      const ctx = TurnContext.create();
      const snapshot = snapshotFrom(ctx);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.previousSides[0]).toEqual(SideState.empty());
      expect(moveHash.previousSides[1]).toEqual(SideState.empty());
      expect(moveHash.newSides[0]).toEqual(SideState.empty());
      expect(moveHash.newSides[1]).toEqual(SideState.empty());
      expect(moveHash.previousEnPassantTarget).toBe(NO_POSITION);
    });

    test("captures the snapshot's en passant target even when the post-move ctx has cleared it", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = E4;
      const snapshot = snapshotFrom(ctx);
      ctx.enPassantTarget = NO_POSITION;
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.previousEnPassantTarget).toBe(E4);
    });

    test("captures a black-pawn move's snapshot/hash pair correctly", () => {
      const blackMove = {
        piece: { type: PAWN, color: BLACK },
        from: E4,
        to: E2,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };
      const ctx = TurnContext.create();
      ctx.sideToMove = BLACK;
      const snapshot = Snapshot.create(ctx, blackMove);
      const moveHash = MoveHash.create(snapshot, ctx);
      expect(moveHash.move).toBe(blackMove);
      expect(moveHash.previousSides).toEqual(snapshot.previousSides);
      expect(moveHash.newSides).toEqual(ctx.sides);
    });
  });
});
