import { describe, expect, test } from "bun:test";

import { Board, Square } from "../core/board";
import { CASTLING, type Move } from "../core/move";
import type { PieceColor } from "../core/piece";
import { BISHOP, BLACK, KING, KNIGHT, QUEEN, ROOK, WHITE } from "../core/piece";
import {
  A4,
  A6,
  B1,
  B8,
  C1,
  C8,
  D1,
  D4,
  D8,
  E1,
  E4,
  E8,
  F1,
  F8,
  FILE_C,
  FILE_E,
  G1,
  G8,
  Position,
  RANK_2,
  RANK_6,
} from "../core/position";
import type { SideState } from "../core/state";
import { TurnContext } from "../core/state";
import { getDefaultPieces } from "../piece/default";
import { getDefaultEngine } from "./default";
import { getPseudoLegalMovesImpl } from "./psuedo";

describe("Engine", () => {
  const pieces = getDefaultPieces();
  const engine = getDefaultEngine();

  const defaultSides: [SideState, SideState] = [
    { kingPosition: E1, canCastleKingSide: true, canCastleQueenSide: true },
    { kingPosition: E8, canCastleKingSide: true, canCastleQueenSide: true },
  ];

  function expectCastling(moves: Move[], from: Position, to: Position, color: PieceColor): void {
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CASTLING,
          piece: { type: KING, color },
          from,
          to,
          captured: null,
          promoteTo: null,
        }),
      ]),
    );
  }

  function expectNoCastling(moves: Move[], from: Position, to: Position): void {
    expect(moves.find((m) => m.type === CASTLING && m.from === from && m.to === to)).toBeUndefined();
  }

  function kingCtx(
    kingPos: Position,
    side: PieceColor,
    sides: [SideState, SideState],
    setup: (b: Board) => void,
  ): TurnContext {
    const ctx = TurnContext.create();
    ctx.sideToMove = side;
    ctx.sides = [sides[0], sides[1]];
    Board.place(ctx.board, kingPos, Square.create({ type: KING, color: side }));
    setup(ctx.board);
    return ctx;
  }

  describe("getPseudoLegalMoves", () => {
    describe("pieces.pseudoLegalMove", () => {
      test("empty square returns no moves", () => {
        const ctx = TurnContext.create();
        const moves: Move[] = [];
        const result = engine.getPseudoLegalMoves(moves, E4, ctx);
        expect(result).toHaveLength(0);
      });

      test("enemy piece on square returns no moves", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, E8, Square.create({ type: KING, color: BLACK }));
        const moves: Move[] = [];
        const result = engine.getPseudoLegalMoves(moves, E8, ctx);
        expect(result).toHaveLength(0);
      });

      test("friendly piece dispatches to correct piece type", () => {
        const ctx = TurnContext.create();
        Board.place(ctx.board, D4, Square.create({ type: KNIGHT, color: WHITE }));
        const moves: Move[] = [];
        const result = engine.getPseudoLegalMoves(moves, D4, ctx);
        expect(result.length).toBeGreaterThan(0);
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              from: D4,
              to: Position.create(FILE_C, RANK_2),
            }),
            expect.objectContaining({
              from: D4,
              to: Position.create(FILE_E, RANK_6),
            }),
          ]),
        );
      });
    });

    describe("castlingMoves", () => {
      test("king not on E file returns no castling moves", () => {
        const ctx = kingCtx(D1, WHITE, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, D1, ctx);
        for (const m of moves) {
          expect(m.type).not.toBe(CASTLING);
        }
      });

      test("king in check returns no castling moves", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, E8, Square.create({ type: ROOK, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        for (const m of moves) {
          expect(m.type).not.toBe(CASTLING);
        }
      });

      test("both rights and clear paths produce two castling moves", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, G1, WHITE);
        expectCastling(moves, E1, C1, WHITE);
      });

      test("only king-side right available", () => {
        const sides: [SideState, SideState] = [
          {
            kingPosition: E1,
            canCastleKingSide: true,
            canCastleQueenSide: false,
          },
          {
            kingPosition: E8,
            canCastleKingSide: true,
            canCastleQueenSide: true,
          },
        ];
        const ctx = kingCtx(E1, WHITE, sides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, G1, WHITE);
        expectNoCastling(moves, E1, C1);
      });

      test("only queen-side right available", () => {
        const sides: [SideState, SideState] = [
          {
            kingPosition: E1,
            canCastleKingSide: false,
            canCastleQueenSide: true,
          },
          {
            kingPosition: E8,
            canCastleKingSide: true,
            canCastleQueenSide: true,
          },
        ];
        const ctx = kingCtx(E1, WHITE, sides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, C1, WHITE);
        expectNoCastling(moves, E1, G1);
      });

      test("black king on E8 with both rights", () => {
        const ctx = kingCtx(E8, BLACK, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E8, ctx);
        expectCastling(moves, E8, G8, BLACK);
        expectCastling(moves, E8, C8, BLACK);
      });

      test("king-side path blocked by F1 piece", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, F1, Square.create({ type: BISHOP, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
        expectCastling(moves, E1, C1, WHITE);
      });

      test("queen-side blocked by B1 piece", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, B1, Square.create({ type: KNIGHT, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, G1, WHITE);
        expectNoCastling(moves, E1, C1);
      });

      test("queen-side path blocked by D1 piece", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, D1, Square.create({ type: QUEEN, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, G1, WHITE);
        expectNoCastling(moves, E1, C1);
      });
    });

    describe("canCastleKingSide", () => {
      test("no king-side right returns false", () => {
        const sides: [SideState, SideState] = [
          {
            kingPosition: E1,
            canCastleKingSide: false,
            canCastleQueenSide: true,
          },
          {
            kingPosition: E8,
            canCastleKingSide: true,
            canCastleQueenSide: true,
          },
        ];
        const ctx = kingCtx(E1, WHITE, sides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("F1 occupied by friendly piece blocks", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, F1, Square.create({ type: BISHOP, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("G1 occupied by friendly piece blocks", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, G1, Square.create({ type: KNIGHT, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("F1 occupied by enemy piece blocks", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, F1, Square.create({ type: KNIGHT, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("F1 attacked by rook blocks king-side", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, F8, Square.create({ type: ROOK, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("G1 attacked by rook blocks king-side", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, G8, Square.create({ type: ROOK, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("F1 attacked by bishop blocks king-side", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, A6, Square.create({ type: BISHOP, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, G1);
      });

      test("all clear returns true (white rank 1)", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, G1, WHITE);
      });

      test("all clear for black (rank 8)", () => {
        const ctx = kingCtx(E8, BLACK, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E8, ctx);
        expectCastling(moves, E8, G8, BLACK);
      });
    });

    describe("canCastleQueenSide", () => {
      test("no queen-side right returns false", () => {
        const sides: [SideState, SideState] = [
          {
            kingPosition: E1,
            canCastleKingSide: true,
            canCastleQueenSide: false,
          },
          {
            kingPosition: E8,
            canCastleKingSide: true,
            canCastleQueenSide: true,
          },
        ];
        const ctx = kingCtx(E1, WHITE, sides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("D1 occupied by friendly piece blocks", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, D1, Square.create({ type: QUEEN, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("C1 occupied by friendly piece blocks", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, C1, Square.create({ type: BISHOP, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("B1 occupied by friendly piece blocks", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, B1, Square.create({ type: KNIGHT, color: WHITE }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("D1 attacked by rook blocks queen-side", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, D8, Square.create({ type: ROOK, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("C1 attacked by rook blocks queen-side", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, C8, Square.create({ type: ROOK, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("D1 attacked by bishop blocks queen-side", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, A4, Square.create({ type: BISHOP, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectNoCastling(moves, E1, C1);
      });

      test("B1 attacked does NOT block (king doesn't pass through B1)", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, (b) => {
          Board.place(b, B8, Square.create({ type: ROOK, color: BLACK }));
        });
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, C1, WHITE);
      });

      test("all clear returns true (white rank 1)", () => {
        const ctx = kingCtx(E1, WHITE, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E1, ctx);
        expectCastling(moves, E1, C1, WHITE);
      });

      test("all clear for black (rank 8)", () => {
        const ctx = kingCtx(E8, BLACK, defaultSides, () => {});
        const moves: Move[] = [];
        getPseudoLegalMovesImpl(pieces, moves, E8, ctx);
        expectCastling(moves, E8, C8, BLACK);
      });
    });
  });
});
