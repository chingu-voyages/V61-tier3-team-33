import { describe, test, expect } from "bun:test";

import { Board, Square } from "../core/board";
import type { PieceType } from "../core/piece";
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
import {
  File,
  Position,
  NO_POSITION,
  RANK_1,
  RANK_2,
  RANK_7,
  RANK_8,
} from "../core/position";
import {
  A1,
  A8,
  B1,
  B8,
  C1,
  C8,
  D1,
  D8,
  E1,
  E3,
  E8,
  F1,
  F8,
  H8,
} from "../core/position";
import { TurnContext } from "../core/state";

import { getDefaultParser } from "./default";

describe("FEN", () => {
  describe("Encode", () => {
    const parser = getDefaultParser();

    function roundTrip(fen: string): string {
      const ctx = TurnContext.create();
      const err = parser.decode(fen, ctx);
      if (err !== null) {
        throw new Error(`Decode("${fen}") failed: ${err}`);
      }
      return parser.encode(ctx);
    }

    // =========================================================================
    // Round-trip
    // =========================================================================

    test("the starting position round-trips to the same FEN", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("the Kiwipete position round-trips to the same FEN", () => {
      const fen =
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("a position with no castling rights round-trips", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("a position with only some castling rights round-trips", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Kq - 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("a position with an en passant target round-trips", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("a position with black to move round-trips", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("a position with multi-digit clocks round-trips", () => {
      const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 47 132";
      expect(roundTrip(fen)).toBe(fen);
    });

    test("an empty board with two kings round-trips", () => {
      const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
      expect(roundTrip(fen)).toBe(fen);
    });

    // =========================================================================
    // Individual field checks
    // =========================================================================

    test("piece placement emits rank 8 first, then 7, down to 1", () => {
      const ctx = TurnContext.create();
      Board.place(ctx.board, E1, Square.create({ type: KING, color: WHITE }));
      Board.place(ctx.board, E8, Square.create({ type: KING, color: BLACK }));
      const got = parser.encode(ctx);
      expect(got.split(" ")[0]).toBe("4k3/8/8/8/8/8/8/4K3");
    });

    test("consecutive empty squares collapse into a single digit", () => {
      const ctx = TurnContext.create();
      expect(parser.encode(ctx).split(" ")[0]).toBe("8/8/8/8/8/8/8/8");
    });

    test("a rank with mixed pieces and empties encodes correctly", () => {
      const ctx = TurnContext.create();
      ctx.board = Board.create();
      Board.place(ctx.board, A8, Square.create({ type: ROOK, color: BLACK }));
      Board.place(ctx.board, E8, Square.create({ type: KING, color: BLACK }));
      Board.place(ctx.board, H8, Square.create({ type: ROOK, color: BLACK }));

      const got = parser.encode(ctx).split(" ")[0];
      expect(got).toBe("r3k2r/8/8/8/8/8/8/8");
    });

    test("all six piece types encode with the correct letter and case", () => {
      const ctx = TurnContext.create();
      Board.place(ctx.board, A1, Square.create({ type: PAWN, color: WHITE }));
      Board.place(ctx.board, B1, Square.create({ type: KNIGHT, color: WHITE }));
      Board.place(ctx.board, C1, Square.create({ type: BISHOP, color: WHITE }));
      Board.place(ctx.board, D1, Square.create({ type: ROOK, color: WHITE }));
      Board.place(ctx.board, E1, Square.create({ type: QUEEN, color: WHITE }));
      Board.place(ctx.board, F1, Square.create({ type: KING, color: WHITE }));
      Board.place(ctx.board, A8, Square.create({ type: PAWN, color: BLACK }));
      Board.place(ctx.board, B8, Square.create({ type: KNIGHT, color: BLACK }));
      Board.place(ctx.board, C8, Square.create({ type: BISHOP, color: BLACK }));
      Board.place(ctx.board, D8, Square.create({ type: ROOK, color: BLACK }));
      Board.place(ctx.board, E8, Square.create({ type: QUEEN, color: BLACK }));
      Board.place(ctx.board, F8, Square.create({ type: KING, color: BLACK }));

      expect(parser.encode(ctx).split(" ")[0]).toBe(
        "pnbrqk2/8/8/8/8/8/8/PNBRQK2",
      );
    });

    test("side to move emits 'w' for white", () => {
      const ctx = TurnContext.create();
      ctx.sideToMove = WHITE;
      expect(parser.encode(ctx).split(" ")[1]).toBe("w");
    });

    test("side to move emits 'b' for black", () => {
      const ctx = TurnContext.create();
      ctx.sideToMove = BLACK;
      expect(parser.encode(ctx).split(" ")[1]).toBe("b");
    });

    test("full castling rights emit KQkq in that order", () => {
      const ctx = TurnContext.create();
      ctx.sides[0].canCastleKingSide = true;
      ctx.sides[0].canCastleQueenSide = true;
      ctx.sides[1].canCastleKingSide = true;
      ctx.sides[1].canCastleQueenSide = true;
      expect(parser.encode(ctx).split(" ")[2]).toBe("KQkq");
    });

    test("no castling rights emit '-'", () => {
      const ctx = TurnContext.create();
      expect(parser.encode(ctx).split(" ")[2]).toBe("-");
    });

    test("partial castling rights emit only the active letters", () => {
      const ctx = TurnContext.create();
      ctx.sides[0].canCastleKingSide = true;
      ctx.sides[1].canCastleQueenSide = true;
      expect(parser.encode(ctx).split(" ")[2]).toBe("Kq");
    });

    test("en passant target emits the square in algebraic notation", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = E3;
      expect(parser.encode(ctx).split(" ")[3]).toBe("e3");
    });

    test("no en passant target emits '-'", () => {
      const ctx = TurnContext.create();
      ctx.enPassantTarget = NO_POSITION;
      expect(parser.encode(ctx).split(" ")[3]).toBe("-");
    });

    test("the halfmove clock emits as a decimal number", () => {
      const ctx = TurnContext.create();
      ctx.halfMoveClock = 47;
      expect(parser.encode(ctx).split(" ")[4]).toBe("47");
    });

    test("a zero halfmove clock emits '0'", () => {
      const ctx = TurnContext.create();
      ctx.halfMoveClock = 0;
      expect(parser.encode(ctx).split(" ")[4]).toBe("0");
    });

    test("the fullmove number emits as a decimal number", () => {
      const ctx = TurnContext.create();
      ctx.fullMoveNumber = 132;
      expect(parser.encode(ctx).split(" ")[5]).toBe("132");
    });

    test("a fullmove number of 1 emits '1'", () => {
      const ctx = TurnContext.create();
      ctx.fullMoveNumber = 1;
      expect(parser.encode(ctx).split(" ")[5]).toBe("1");
    });

    // =========================================================================
    // Full output structure
    // =========================================================================

    test("the output has exactly six space-separated fields", () => {
      const ctx = TurnContext.create();
      Board.place(ctx.board, E1, Square.create({ type: KING, color: WHITE }));
      Board.place(ctx.board, E8, Square.create({ type: KING, color: BLACK }));
      ctx.sideToMove = WHITE;
      ctx.sides[0].canCastleKingSide = true;
      ctx.sides[0].canCastleQueenSide = true;
      ctx.sides[1].canCastleKingSide = true;
      ctx.sides[1].canCastleQueenSide = true;
      ctx.enPassantTarget = NO_POSITION;
      ctx.halfMoveClock = 0;
      ctx.fullMoveNumber = 1;

      expect(parser.encode(ctx).split(" ").length).toBe(6);
    });

    test("a complete hand-built position encodes to the expected FEN", () => {
      const ctx = TurnContext.create();
      const back: readonly PieceType[] = [
        ROOK,
        KNIGHT,
        BISHOP,
        QUEEN,
        KING,
        BISHOP,
        KNIGHT,
        ROOK,
      ];

      for (const [f, pieceType] of back.entries()) {
        const file = File(f);
        Board.place(
          ctx.board,
          Position.create(file, RANK_1),
          Square.create({ type: pieceType, color: WHITE }),
        );
        Board.place(
          ctx.board,
          Position.create(file, RANK_2),
          Square.create({ type: PAWN, color: WHITE }),
        );
        Board.place(
          ctx.board,
          Position.create(file, RANK_7),
          Square.create({ type: PAWN, color: BLACK }),
        );
        Board.place(
          ctx.board,
          Position.create(file, RANK_8),
          Square.create({ type: pieceType, color: BLACK }),
        );
      }

      ctx.sideToMove = WHITE;
      ctx.sides[0].canCastleKingSide = true;
      ctx.sides[0].canCastleQueenSide = true;
      ctx.sides[1].canCastleKingSide = true;
      ctx.sides[1].canCastleQueenSide = true;
      ctx.enPassantTarget = NO_POSITION;
      ctx.halfMoveClock = 0;
      ctx.fullMoveNumber = 1;

      const got = parser.encode(ctx);
      const want = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      expect(got).toBe(want);
    });
  });
});
