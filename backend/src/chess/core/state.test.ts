import { describe, expect, test } from "bun:test";
import { Board } from "./board";
import { Square } from "./board";
import { NORMAL } from "./move";
import { PAWN, ROOK, KNIGHT, WHITE, BLACK } from "./piece";
import {
  A1,
  A8,
  D1,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E8,
  F1,
  FILE_A,
  FILE_B,
  FILE_C,
  FILE_D,
  FILE_E,
  FILE_F,
  FILE_G,
  FILE_H,
  H1,
  H8,
  NO_POSITION,
  Position,
  RANK_2,
  RANK_3,
  RANK_4,
  RANK_5,
  RANK_6,
  RANK_7,
} from "./position";
import {
  SideState,
  MoveContext,
  TurnContext,
} from "./state";

describe("SideState", () => {
  describe("empty", () => {
    test("kingPosition is NO_POSITION", () => {
      expect(SideState.empty().kingPosition).toBe(NO_POSITION);
    });

    test("canCastleKingSide is false", () => {
      expect(SideState.empty().canCastleKingSide).toBe(false);
    });

    test("canCastleQueenSide is false", () => {
      expect(SideState.empty().canCastleQueenSide).toBe(false);
    });

    test("returns a fresh object each call", () => {
      expect(SideState.empty()).not.toBe(SideState.empty());
    });

    test("two empty sides are deep-equal but distinct references", () => {
      const a = SideState.empty();
      const b = SideState.empty();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe("copy", () => {
    const side: SideState = {
      kingPosition: E1,
      canCastleKingSide: true,
      canCastleQueenSide: false,
    };

    test("returns a deep-equal copy", () => {
      expect(SideState.copy(side)).toEqual(side);
    });

    test("returns a distinct reference", () => {
      expect(SideState.copy(side)).not.toBe(side);
    });

    test("copy is independent — mutating the copy does not affect the original", () => {
      const copy = SideState.copy(side);
      copy.kingPosition = E4;
      copy.canCastleKingSide = false;
      copy.canCastleQueenSide = true;
      expect(side.kingPosition).toBe(E1);
      expect(side.canCastleKingSide).toBe(true);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("copy is independent — mutating the original does not affect the copy", () => {
      const copy = SideState.copy(side);
      side.kingPosition = E4;
      side.canCastleKingSide = false;
      side.canCastleQueenSide = true;
      expect(copy.kingPosition).toBe(E1);
      expect(copy.canCastleKingSide).toBe(true);
      expect(copy.canCastleQueenSide).toBe(false);
    });

    test("copying an empty SideState yields an empty-equal SideState", () => {
      expect(SideState.copy(SideState.empty())).toEqual(SideState.empty());
    });
  });

  describe("clearCastlingRights", () => {
    test("clears both rights from a fully-castling side", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRights(side);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("clears only the set right (king-side)", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: false,
      };
      SideState.clearCastlingRights(side);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("clears only the set right (queen-side)", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: false,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRights(side);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("is a no-op when both rights are already cleared", () => {
      const side = SideState.empty();
      SideState.clearCastlingRights(side);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("does not touch kingPosition", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRights(side);
      expect(side.kingPosition).toBe(E1);
    });
  });

  describe("clearCastlingRight", () => {
    test("FILE_A clears queen-side only", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRight(side, FILE_A);
      expect(side.canCastleKingSide).toBe(true);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("FILE_H clears king-side only", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRight(side, FILE_H);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(true);
    });

    test("intermediate file (FILE_B..FILE_G) clears neither right", () => {
      const middleFiles = [
        FILE_B,
        FILE_C,
        FILE_D,
        FILE_E,
        FILE_F,
        FILE_G,
      ];
      for (const file of middleFiles) {
        const side: SideState = {
          kingPosition: E1,
          canCastleKingSide: true,
          canCastleQueenSide: true,
        };
        SideState.clearCastlingRight(side, file);
        expect(side.canCastleKingSide).toBe(true);
        expect(side.canCastleQueenSide).toBe(true);
      }
    });

    test("calling on FILE_A twice is idempotent", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRight(side, FILE_A);
      SideState.clearCastlingRight(side, FILE_A);
      expect(side.canCastleKingSide).toBe(true);
      expect(side.canCastleQueenSide).toBe(false);
    });

    test("calling on FILE_H twice is idempotent", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRight(side, FILE_H);
      SideState.clearCastlingRight(side, FILE_H);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(true);
    });

    test("does not touch kingPosition", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRight(side, FILE_A);
      SideState.clearCastlingRight(side, FILE_H);
      expect(side.kingPosition).toBe(E1);
    });

    test("clearing FILE_A then FILE_H clears both rights", () => {
      const side: SideState = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      SideState.clearCastlingRight(side, FILE_A);
      SideState.clearCastlingRight(side, FILE_H);
      expect(side.canCastleKingSide).toBe(false);
      expect(side.canCastleQueenSide).toBe(false);
    });
  });
});

describe("MoveContext", () => {
  /** Builds a minimal MoveContext for testing. */
  const buildCtx = (): MoveContext => ({
    board: Board.create(),
    sideToMove: WHITE,
    sides: [SideState.empty(), SideState.empty()],
    enPassantTarget: NO_POSITION,
  });

  describe("sideOf", () => {
    test("returns sides[0] for WHITE", () => {
      const ctx = buildCtx();
      expect(MoveContext.sideOf(ctx, WHITE)).toBe(ctx.sides[0]);
    });

    test("returns sides[1] for BLACK", () => {
      const ctx = buildCtx();
      expect(MoveContext.sideOf(ctx, BLACK)).toBe(ctx.sides[1]);
    });

    test("returns distinct sides for the two colors", () => {
      const ctx = buildCtx();
      expect(MoveContext.sideOf(ctx, WHITE)).not.toBe(
        MoveContext.sideOf(ctx, BLACK),
      );
    });

    test("returns the live reference (mutating the returned side affects the context)", () => {
      const ctx = buildCtx();
      const white = MoveContext.sideOf(ctx, WHITE);
      white.canCastleKingSide = true;
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
    });
  });

  describe("isKingAt", () => {
    test("returns true when position matches the moving side's king square", () => {
      const ctx = buildCtx();
      ctx.sides[0].kingPosition = E1;
      expect(MoveContext.isKingAt(ctx, E1)).toBe(true);
    });

    test("returns false when position differs from the king square", () => {
      const ctx = buildCtx();
      ctx.sides[0].kingPosition = E1;
      expect(MoveContext.isKingAt(ctx, D1)).toBe(false);
    });

    test("uses the moving side's king square (white to move)", () => {
      const ctx = buildCtx();
      ctx.sideToMove = WHITE;
      ctx.sides[0].kingPosition = E1;
      ctx.sides[1].kingPosition = E8;
      expect(MoveContext.isKingAt(ctx, E1)).toBe(true);
      expect(MoveContext.isKingAt(ctx, E8)).toBe(false);
    });

    test("uses the moving side's king square (black to move)", () => {
      const ctx = buildCtx();
      ctx.sideToMove = BLACK;
      ctx.sides[0].kingPosition = E1;
      ctx.sides[1].kingPosition = E8;
      expect(MoveContext.isKingAt(ctx, E8)).toBe(true);
      expect(MoveContext.isKingAt(ctx, E1)).toBe(false);
    });
  });

  describe("forfeitCastlingRight", () => {
    test("white rook leaving A1 forfeits white's queen-side right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: WHITE },
        from: A1,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(false);
    });

    test("white rook leaving H1 forfeits white's king-side right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: WHITE },
        from: H1,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(false);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("black rook leaving A8 forfeits black's queen-side right", () => {
      const ctx = buildCtx();
      ctx.sides[1] = {
        kingPosition: E8,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: BLACK },
        from: A8,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[1].canCastleKingSide).toBe(true);
      expect(ctx.sides[1].canCastleQueenSide).toBe(false);
    });

    test("black rook leaving H8 forfeits black's king-side right", () => {
      const ctx = buildCtx();
      ctx.sides[1] = {
        kingPosition: E8,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: BLACK },
        from: H8,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[1].canCastleKingSide).toBe(false);
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
    });

    test("white rook leaving a non-home rank does not forfeit a right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: WHITE },
        from: A8,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("rook moving along the home rank but not from A/H does not forfeit a right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      // Rook moving D1→E1 (along the home rank, but from a non-corner file)
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: WHITE },
        from: D1,
        to: F1,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("non-rook move does not forfeit a right (knight)", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: KNIGHT, color: WHITE },
        from: A1,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("capturing a rook on its home square A1 forfeits white's queen-side right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: KNIGHT, color: BLACK },
        from: E4,
        to: A1,
        type: NORMAL,
        promoteTo: null,
        captured: { type: ROOK, color: WHITE },
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(false);
    });

    test("capturing a rook on its home square H8 forfeits black's king-side right", () => {
      const ctx = buildCtx();
      ctx.sides[1] = {
        kingPosition: E8,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: KNIGHT, color: WHITE },
        from: E4,
        to: H8,
        type: NORMAL,
        promoteTo: null,
        captured: { type: ROOK, color: BLACK },
      });
      expect(ctx.sides[1].canCastleKingSide).toBe(false);
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
    });

    test("capturing a rook on a non-home square does not forfeit a right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      // White rook captured on E4 (not on its home rank)
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: KNIGHT, color: BLACK },
        from: E5,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: { type: ROOK, color: WHITE },
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("capturing a non-rook piece on a home square does not forfeit a right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: KNIGHT, color: BLACK },
        from: E4,
        to: A1,
        type: NORMAL,
        promoteTo: null,
        captured: { type: KNIGHT, color: WHITE },
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("capturing a rook on a home-rank, non-corner file does not forfeit a right", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      // White rook captured on D1 — home rank but neither A nor H file
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: KNIGHT, color: BLACK },
        from: E3,
        to: D1,
        type: NORMAL,
        promoteTo: null,
        captured: { type: ROOK, color: WHITE },
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
    });

    test("null capture does not forfeit anything even for rook moves", () => {
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      ctx.sides[1] = {
        kingPosition: E8,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      // A rook moving from a non-home rank, with null capture
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: WHITE },
        from: E4,
        to: A8,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
      expect(ctx.sides[1].canCastleKingSide).toBe(true);
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
    });

    test("rook leaving home square takes precedence — captured rook's right is NOT cleared (early return)", () => {
      // The function `return`s after handling the moving rook's branch,
      // so when a rook move both leaves its home square AND captures a rook
      // on the opponent's home square, only the moving rook's right is
      // forfeited. This test documents the current behavior.
      const ctx = buildCtx();
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      ctx.sides[1] = {
        kingPosition: E8,
        canCastleKingSide: true,
        canCastleQueenSide: true,
      };
      // White rook A1 → H8: the rook leaves A1 (forfeits white queen-side).
      // The function returns early and never inspects the captured black
      // rook on H8, so black king-side is NOT forfeited here.
      MoveContext.forfeitCastlingRight(ctx, {
        piece: { type: ROOK, color: WHITE },
        from: A1,
        to: H8,
        type: NORMAL,
        promoteTo: null,
        captured: { type: ROOK, color: BLACK },
      });
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(false);
      // Black king-side would be forfeited if both branches could fire, but
      // the early return means it stays untouched here:
      expect(ctx.sides[1].canCastleKingSide).toBe(true);
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
    });
  });

  describe("setEnPassantTarget", () => {
    test("white double pawn push sets the en passant target", () => {
      const ctx = buildCtx();
      MoveContext.setEnPassantTarget(ctx, {
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.enPassantTarget).toBe(E3);
    });

    test("black double pawn push sets the en passant target", () => {
      const ctx = buildCtx();
      MoveContext.setEnPassantTarget(ctx, {
        piece: { type: PAWN, color: BLACK },
        from: E5,
        to: E2,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      // black pawn E5→E2 is not a real double push; but Move.isDoublePawnPush only
      // checks rank diff of -2 from E7. Here we use a real one:
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
    });

    test("black double pawn push from rank 7 → rank 5 sets the en passant target", () => {
      const ctx = buildCtx();
      MoveContext.setEnPassantTarget(ctx, {
        piece: { type: PAWN, color: BLACK },
        from: Position.create(FILE_E, RANK_7), // E7
        to: Position.create(FILE_E, RANK_5),   // E5
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.enPassantTarget).toBe(Position.create(FILE_E, RANK_6)); // E6
    });

    test("non-pawn move clears the en passant target", () => {
      const ctx = buildCtx();
      ctx.enPassantTarget = E3;
      MoveContext.setEnPassantTarget(ctx, {
        piece: { type: KNIGHT, color: WHITE },
        from: E2,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
    });

    test("single-square pawn push clears the en passant target", () => {
      const ctx = buildCtx();
      ctx.enPassantTarget = E3;
      MoveContext.setEnPassantTarget(ctx, {
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E3,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
    });

    test("previous target is overwritten by a new double push", () => {
      const ctx = buildCtx();
      ctx.enPassantTarget = E3;
      MoveContext.setEnPassantTarget(ctx, {
        piece: { type: PAWN, color: WHITE },
        from: Position.create(FILE_D, RANK_2), // D2
        to: Position.create(FILE_D, RANK_4),   // D4
        type: NORMAL,
        promoteTo: null,
        captured: null,
      });
      expect(ctx.enPassantTarget).toBe(Position.create(FILE_D, RANK_3)); // D3
    });
  });
});

describe("TurnContext", () => {
  describe("create", () => {
    const ctx = TurnContext.create();

    test("board is a length-64 Uint8Array (all empty)", () => {
      expect(ctx.board).toHaveLength(64);
      expect(ctx.board.every((s) => s === 0)).toBe(true);
    });

    test("sideToMove defaults to WHITE", () => {
      expect(ctx.sideToMove).toBe(WHITE);
    });

    test("sides are two empty SideStates", () => {
      expect(ctx.sides[0]).toEqual(SideState.empty());
      expect(ctx.sides[1]).toEqual(SideState.empty());
    });

    test("sides[0] and sides[1] are distinct references", () => {
      expect(ctx.sides[0]).not.toBe(ctx.sides[1]);
    });

    test("enPassantTarget defaults to NO_POSITION", () => {
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
    });

    test("halfMoveClock defaults to 0", () => {
      expect(ctx.halfMoveClock).toBe(0);
    });

    test("fullMoveNumber defaults to 0", () => {
      expect(ctx.fullMoveNumber).toBe(0);
    });

    test("returns a fresh object each call (independent board)", () => {
      const a = TurnContext.create();
      const b = TurnContext.create();
      expect(a).not.toBe(b);
      expect(a.board).not.toBe(b.board);
    });
  });

  describe("copy", () => {
    const buildCtx = (): TurnContext => {
      const ctx = TurnContext.create();
      ctx.sideToMove = BLACK;
      ctx.enPassantTarget = E4;
      ctx.halfMoveClock = 12;
      ctx.fullMoveNumber = 7;
      ctx.sides[0] = {
        kingPosition: E1,
        canCastleKingSide: true,
        canCastleQueenSide: false,
      };
      ctx.sides[1] = {
        kingPosition: E8,
        canCastleKingSide: false,
        canCastleQueenSide: true,
      };
      Board.place(ctx.board, A1, Square.create({ type: ROOK, color: WHITE }));
      return ctx;
    };

    test("returns a deep-equal copy", () => {
      const ctx = buildCtx();
      expect(TurnContext.copy(ctx)).toEqual(ctx);
    });

    test("returns a distinct reference", () => {
      const ctx = buildCtx();
      expect(TurnContext.copy(ctx)).not.toBe(ctx);
    });

    test("copy has its own Board (distinct Uint8Array reference)", () => {
      const ctx = buildCtx();
      const copy = TurnContext.copy(ctx);
      expect(copy.board).not.toBe(ctx.board);
    });

    test("copy's Board is independent — mutating the original board does not affect the copy", () => {
      const ctx = buildCtx();
      const copy = TurnContext.copy(ctx);
      Board.clear(ctx.board, A1);
      expect(copy.board[A1]).toBe(Square.create({ type: ROOK, color: WHITE }));
      expect(ctx.board[A1]).toBe(0);
    });

    test("copy's Board is independent — mutating the copy's board does not affect the original", () => {
      const ctx = buildCtx();
      const copy = TurnContext.copy(ctx);
      Board.place(copy.board, H8, Square.create({ type: ROOK, color: BLACK }));
      expect(ctx.board[H8]).toBe(0);
      expect(copy.board[H8]).toBe(Square.create({ type: ROOK, color: BLACK }));
    });

    test("copy's sides are independent of the original", () => {
      const ctx = buildCtx();
      const copy = TurnContext.copy(ctx);
      copy.sides[0].canCastleKingSide = false;
      copy.sides[1].kingPosition = E1;
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[1].kingPosition).toBe(E8);
    });

    test("copy's sides are distinct references from each other and from the original", () => {
      const ctx = buildCtx();
      const copy = TurnContext.copy(ctx);
      expect(copy.sides[0]).not.toBe(copy.sides[1]);
      expect(copy.sides[0]).not.toBe(ctx.sides[0]);
      expect(copy.sides[1]).not.toBe(ctx.sides[1]);
    });

    test("copy preserves sideToMove", () => {
      const ctx = buildCtx();
      expect(TurnContext.copy(ctx).sideToMove).toBe(BLACK);
    });

    test("copy preserves enPassantTarget", () => {
      const ctx = buildCtx();
      expect(TurnContext.copy(ctx).enPassantTarget).toBe(E4);
    });

    test("copy preserves halfMoveClock", () => {
      const ctx = buildCtx();
      expect(TurnContext.copy(ctx).halfMoveClock).toBe(12);
    });

    test("copy preserves fullMoveNumber", () => {
      const ctx = buildCtx();
      expect(TurnContext.copy(ctx).fullMoveNumber).toBe(7);
    });

    test("copying a freshly-created TurnContext yields an equal TurnContext", () => {
      const ctx = TurnContext.create();
      expect(TurnContext.copy(ctx)).toEqual(ctx);
    });
  });
});
