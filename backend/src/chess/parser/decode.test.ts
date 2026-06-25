import { describe, test, expect } from "bun:test";

import { Board, Square } from "../core/board";
import type { PieceType, PieceColor } from "../core/piece";
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
import type { Position } from "../core/position";
import {
  File,
  Position as Pos,
  A1,
  A2,
  A7,
  A8,
  B1,
  B2,
  B6,
  B7,
  B8,
  C1,
  C2,
  C7,
  C8,
  D1,
  D2,
  D5,
  D6,
  D7,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E7,
  E8,
  F2,
  F3,
  F7,
  F8,
  G1,
  G7,
  G8,
  H1,
  H2,
  H7,
  H8,
  RANK_4,
  RANK_5,
  NO_POSITION,
} from "../core/position";
import { TurnContext } from "../core/state";

import { getDefaultParser } from "./default";

describe("FEN", () => {
  describe("Decode", () => {
    const parser = getDefaultParser();

    function assertSquareHas(
      ctx: TurnContext,
      pos: Position,
      type: PieceType,
      color: PieceColor,
    ) {
      const square = Board.at(ctx.board, pos);
      expect(Square.isOccupied(square)).toBe(true);
      expect(Square.pieceType(square)).toBe(type);
      expect(Square.pieceColor(square)).toBe(color);
    }

    function assertSquareEmpty(ctx: TurnContext, pos: Position) {
      expect(Square.isEmpty(Board.at(ctx.board, pos))).toBe(true);
    }

    function decode(fen: string): { ctx: TurnContext; err: string | null } {
      const ctx = TurnContext.create();
      const err = parser.decode(fen, ctx);
      return { ctx, err };
    }

    function mustDecode(fen: string): TurnContext {
      const { ctx, err } = decode(fen);
      if (err !== null) {
        throw new Error(`Decode("${fen}") returned error: ${err}`);
      }
      return ctx;
    }

    function mustFail(fen: string) {
      const { err } = decode(fen);
      expect(err).not.toBeNull();
    }

    test("the standard starting position parses with all fields correct", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );

      assertSquareHas(ctx, A8, ROOK, BLACK);
      assertSquareHas(ctx, E8, KING, BLACK);
      assertSquareHas(ctx, A7, PAWN, BLACK);
      assertSquareHas(ctx, H7, PAWN, BLACK);
      assertSquareEmpty(ctx, E4);
      assertSquareEmpty(ctx, D5);
      assertSquareHas(ctx, A2, PAWN, WHITE);
      assertSquareHas(ctx, H2, PAWN, WHITE);
      assertSquareHas(ctx, D1, QUEEN, WHITE);
      assertSquareHas(ctx, E1, KING, WHITE);

      expect(ctx.sideToMove).toBe(WHITE);
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
      expect(ctx.sides[1].canCastleKingSide).toBe(true);
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
      expect(ctx.halfMoveClock).toBe(0);
      expect(ctx.fullMoveNumber).toBe(1);
    });

    test("the Kiwipete position parses correctly", () => {
      const ctx = mustDecode(
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
      );

      assertSquareHas(ctx, A8, ROOK, BLACK);
      assertSquareHas(ctx, E8, KING, BLACK);
      assertSquareHas(ctx, H8, ROOK, BLACK);
      assertSquareHas(ctx, E7, QUEEN, BLACK);
      assertSquareHas(ctx, G7, BISHOP, BLACK);
      assertSquareHas(ctx, B6, KNIGHT, BLACK);
      assertSquareHas(ctx, D5, PAWN, WHITE);
      assertSquareHas(ctx, E5, KNIGHT, WHITE);
      assertSquareHas(ctx, F3, QUEEN, WHITE);
      assertSquareHas(ctx, E1, KING, WHITE);
      assertSquareHas(ctx, A1, ROOK, WHITE);
      assertSquareHas(ctx, H1, ROOK, WHITE);
      expect(ctx.sideToMove).toBe(WHITE);
    });

    test("a position with black to move parses with the correct side", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
      );
      expect(ctx.sideToMove).toBe(BLACK);
    });

    test("a position with no castling rights parses with all rights false", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
      );
      expect(ctx.sides[0].canCastleKingSide).toBe(false);
      expect(ctx.sides[0].canCastleQueenSide).toBe(false);
      expect(ctx.sides[1].canCastleKingSide).toBe(false);
      expect(ctx.sides[1].canCastleQueenSide).toBe(false);
    });

    test("a position with only white king-side castling parses with that single right", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w K - 0 1",
      );
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(false);
      expect(ctx.sides[1].canCastleKingSide).toBe(false);
      expect(ctx.sides[1].canCastleQueenSide).toBe(false);
    });

    test("a position with only black queen-side castling parses with that single right", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w q - 0 1",
      );
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
      expect(ctx.sides[1].canCastleKingSide).toBe(false);
      expect(ctx.sides[0].canCastleKingSide).toBe(false);
      expect(ctx.sides[0].canCastleQueenSide).toBe(false);
    });

    test("an en passant target on rank 3 parses correctly", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      );
      expect(ctx.enPassantTarget).toBe(E3);
    });

    test("an en passant target on rank 6 parses correctly", () => {
      const ctx = mustDecode(
        "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2",
      );
      expect(ctx.enPassantTarget).toBe(D6);
    });

    test("the halfmove clock and fullmove number parse as decimal numbers", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 47 132",
      );
      expect(ctx.halfMoveClock).toBe(47);
      expect(ctx.fullMoveNumber).toBe(132);
    });

    test("digit runs place the correct number of empty squares", () => {
      const ctx = mustDecode(
        "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );
      assertSquareHas(ctx, A8, ROOK, BLACK);
      assertSquareEmpty(ctx, B8);
      assertSquareEmpty(ctx, C8);
      assertSquareEmpty(ctx, D8);
      assertSquareHas(ctx, E8, KING, BLACK);
      assertSquareEmpty(ctx, F8);
      assertSquareEmpty(ctx, G8);
      assertSquareHas(ctx, H8, ROOK, BLACK);
    });

    test("the digit 8 fills an entire rank with empties", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );
      for (let f = 0; f < 8; f++) {
        assertSquareEmpty(ctx, Pos.create(File(f), RANK_4));
        assertSquareEmpty(ctx, Pos.create(File(f), RANK_5));
      }
    });

    test("pieces are placed on the correct squares from FEN rank 8", () => {
      const ctx = mustDecode("8/8/8/8/8/8/8/1N6 w - - 0 1");
      assertSquareHas(ctx, B1, KNIGHT, WHITE);
      assertSquareEmpty(ctx, A1);
      assertSquareEmpty(ctx, C1);
      assertSquareEmpty(ctx, A8);
    });

    test("pieces are placed on the correct squares from FEN rank 1", () => {
      const ctx = mustDecode("4k3/8/8/8/8/8/8/8 w - - 0 1");
      assertSquareHas(ctx, E8, KING, BLACK);
      assertSquareEmpty(ctx, A8);
      assertSquareEmpty(ctx, E1);
    });

    test("all six piece types parse for both colors", () => {
      const ctx = mustDecode("8/PNBRQK1p/8/8/8/8/pnbrqk1P/8 w - - 0 1");
      assertSquareHas(ctx, A7, PAWN, WHITE);
      assertSquareHas(ctx, B7, KNIGHT, WHITE);
      assertSquareHas(ctx, C7, BISHOP, WHITE);
      assertSquareHas(ctx, D7, ROOK, WHITE);
      assertSquareHas(ctx, E7, QUEEN, WHITE);
      assertSquareHas(ctx, F7, KING, WHITE);
      assertSquareHas(ctx, H7, PAWN, BLACK);
      assertSquareHas(ctx, A2, PAWN, BLACK);
      assertSquareHas(ctx, B2, KNIGHT, BLACK);
      assertSquareHas(ctx, C2, BISHOP, BLACK);
      assertSquareHas(ctx, D2, ROOK, BLACK);
      assertSquareHas(ctx, E2, QUEEN, BLACK);
      assertSquareHas(ctx, F2, KING, BLACK);
      assertSquareHas(ctx, H2, PAWN, WHITE);
    });

    test("a rank with too few files returns an error", () => {
      mustFail("rnbqkbn/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    });

    test("a rank with too many files returns an error", () => {
      mustFail("rnbqkbnrp/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    });

    test("a digit that overflows the rank returns an error", () => {
      mustFail("r9/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    });

    test("too many ranks returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR/8 w KQkq - 0 1");
    });

    test("too few ranks returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1");
    });

    test("an invalid piece letter returns an error", () => {
      mustFail("rnbqkbnx/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    });

    test("a piece placement field with no space terminator returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    });

    test("a side-to-move letter other than w or b returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1");
    });

    test("a missing side-to-move field returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR ");
    });

    test("an invalid castling-rights letter returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w XQkq - 0 1");
    });

    test("a missing castling-rights field returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w ");
    });

    test("an en passant target on an invalid rank returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1");
    });

    test("an en passant target with an invalid file returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq z3 0 1");
    });

    test("an en passant target that is too short returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e");
    });

    test("a missing en-passant-target field returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq ");
    });

    test("a halfmove clock that is not a number returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ab 1");
    });

    test("a missing halfmove-clock field returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ");
    });

    test("a fullmove number that is not a number returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ab");
    });

    test("a missing fullmove-number field returns an error", () => {
      mustFail("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ");
    });

    test("an empty string returns an error", () => {
      mustFail("");
    });

    test("the en passant target of '-' sets NO_POSITION", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
    });

    test("castling rights can appear in any order", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w kqKQ - 0 1",
      );
      expect(ctx.sides[0].canCastleKingSide).toBe(true);
      expect(ctx.sides[0].canCastleQueenSide).toBe(true);
      expect(ctx.sides[1].canCastleKingSide).toBe(true);
      expect(ctx.sides[1].canCastleQueenSide).toBe(true);
    });

    test("Decode can be called twice on the same ctx without leftover state", () => {
      const ctx = TurnContext.create();
      parser.decode(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 5 10",
        ctx,
      );
      parser.decode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ctx,
      );
      expect(ctx.enPassantTarget).toBe(NO_POSITION);
      expect(ctx.sideToMove).toBe(WHITE);
      expect(ctx.halfMoveClock).toBe(0);
      expect(ctx.fullMoveNumber).toBe(1);
      assertSquareEmpty(ctx, E4);
      assertSquareHas(ctx, E2, PAWN, WHITE);
    });

    test("the white king position is detected from the board", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );
      expect(ctx.sides[0].kingPosition).toBe(E1);
    });

    test("the black king position is detected from the board", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );
      expect(ctx.sides[1].kingPosition).toBe(E8);
    });

    test("a king that has castled to G1 is detected at G1", () => {
      const ctx = mustDecode(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R4RK1 w kq - 0 1",
      );
      expect(ctx.sides[0].kingPosition).toBe(G1);
    });

    test("a king that has castled to C8 is detected at C8", () => {
      const ctx = mustDecode(
        "2kr3r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1",
      );
      expect(ctx.sides[1].kingPosition).toBe(C8);
    });

    test("a king in the middle of the board is detected at its square", () => {
      const ctx = mustDecode("8/8/8/3k4/4K3/8/8/8 w - - 0 1");
      expect(ctx.sides[0].kingPosition).toBe(E4);
      expect(ctx.sides[1].kingPosition).toBe(D5);
    });

    test("a missing white king leaves KingPosition at NO_POSITION", () => {
      const ctx = mustDecode("4k3/8/8/8/8/8/8/8 w - - 0 1");
      expect(ctx.sides[0].kingPosition).toBe(NO_POSITION);
    });
  });
});
