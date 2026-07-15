import { describe, expect, test } from "bun:test";

import { Board, Square } from "../core/board";
import type { Move } from "../core/move";
import { CASTLING, EN_PASSANT, NORMAL, PROMOTION } from "../core/move";
import type { PieceColor } from "../core/piece";
import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import {
  A1,
  A2,
  A3,
  A5,
  B1,
  B3,
  B5,
  C1,
  C2,
  C3,
  C8,
  D1,
  D2,
  D3,
  D4,
  D5,
  D6,
  D7,
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
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  G1,
  G7,
  H1,
  H5,
  H8,
  NO_POSITION,
} from "../core/position";
import { TurnContext } from "../core/state";
import { getDefaultEngine } from "./default";

describe("Engine", () => {
  const engine = getDefaultEngine();

  function turnFor(side: PieceColor, setup: (ctx: TurnContext) => void): TurnContext {
    const ctx = TurnContext.create();
    ctx.sideToMove = side;
    setup(ctx);
    return ctx;
  }

  describe("getLegalMoves", () => {
    test("pinned rook along pin line", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E2, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E2, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(E3)).toBe(true);
      expect(toSquares.has(E8)).toBe(true);
      expect(toSquares.has(D2)).toBe(false);
      expect(toSquares.has(F2)).toBe(false);
      expect(result.length).toBe(6);
    });

    test("pinned bishop no legal moves", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E2, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E2, ctx);
      expect(result.length).toBe(0);
    });

    test("king in check escapes sideways", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(D1)).toBe(true);
      expect(toSquares.has(F1)).toBe(true);
      expect(toSquares.has(D2)).toBe(true);
      expect(toSquares.has(F2)).toBe(true);
      expect(toSquares.has(E2)).toBe(false);
      expect(toSquares.has(G1)).toBe(false);
      expect(toSquares.has(C1)).toBe(false);
      expect(result.length).toBe(4);
    });

    test("king in check on rank 1 must escape to rank 2", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(D2)).toBe(true);
      expect(toSquares.has(E2)).toBe(true);
      expect(toSquares.has(F2)).toBe(true);
      expect(toSquares.has(D1)).toBe(false);
      expect(toSquares.has(F1)).toBe(false);
      expect(result.length).toBe(3);
    });

    test("king captures undefended checker", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E4, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E5, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E4;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E4, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(E5)).toBe(true);
      expect(toSquares.has(D3)).toBe(true);
      expect(toSquares.has(D4)).toBe(true);
      expect(toSquares.has(F3)).toBe(true);
      expect(toSquares.has(F4)).toBe(true);
      expect(toSquares.has(D5)).toBe(false);
      expect(toSquares.has(E3)).toBe(false);
      expect(toSquares.has(F5)).toBe(false);
      expect(result.length).toBe(5);
    });

    test("king cannot capture defended checker", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E4, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E5, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, D6, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E4;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E4, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(E5)).toBe(false);
      expect(toSquares.has(D3)).toBe(true);
      expect(toSquares.has(D4)).toBe(true);
      expect(toSquares.has(F3)).toBe(true);
      expect(toSquares.has(F4)).toBe(true);
      expect(result.length).toBe(4);
    });

    test("king cannot capture defended adjacent piece", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, D2, Square.create({ type: KNIGHT, color: BLACK }));
        Board.place(c.board, C3, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(D2)).toBe(false);
      expect(toSquares.has(F1)).toBe(false);
      expect(toSquares.has(D1)).toBe(true);
      expect(toSquares.has(E2)).toBe(true);
      expect(toSquares.has(F2)).toBe(true);
      expect(result.length).toBe(3);
    });

    test("king cannot move adjacent to enemy king", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E4, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E6, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E4;
        c.sides[1].kingPosition = E6;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E4, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(D3)).toBe(true);
      expect(toSquares.has(D4)).toBe(true);
      expect(toSquares.has(E3)).toBe(true);
      expect(toSquares.has(F3)).toBe(true);
      expect(toSquares.has(F4)).toBe(true);
      expect(toSquares.has(D5)).toBe(false);
      expect(toSquares.has(E5)).toBe(false);
      expect(toSquares.has(F5)).toBe(false);
      expect(result.length).toBe(5);
    });

    test("knight blocks check or captures checker", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, D6, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, D6, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(E4)).toBe(true);
      expect(toSquares.has(E8)).toBe(true);
      expect(toSquares.has(B5)).toBe(false);
      expect(toSquares.has(F7)).toBe(false);
      expect(toSquares.has(C8)).toBe(false);
      expect(result.length).toBe(2);
    });

    test("en passant exposing king is illegal", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, H5, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, F5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, E5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, A5, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = H5;
        c.sides[1].kingPosition = E8;
        c.enPassantTarget = E6;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, F5, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(E6)).toBe(false);
      expect(toSquares.has(F6)).toBe(true);
      expect(result.length).toBe(1);
    });

    test("promotion blocked by check can still capture checker", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, D7, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, D7, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(D8)).toBe(false);
      expect(toSquares.has(E8)).toBe(true);
      expect(result.every((m) => m.type === PROMOTION)).toBe(true);
      expect(result.length).toBe(4);
    });

    test("castling available when conditions met", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(G1)).toBe(true);
      expect(toSquares.has(C1)).toBe(true);
      expect(toSquares.has(D1)).toBe(true);
      expect(toSquares.has(F1)).toBe(true);
      expect(result.length).toBe(7);
    });

    test("castling removed when king in check", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(G1)).toBe(false);
      expect(toSquares.has(C1)).toBe(false);
      expect(result.length).toBe(4);
    });

    test("king-side castling blocked by F1 occupied", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, F1, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(G1)).toBe(false);
      expect(toSquares.has(C1)).toBe(true);
      expect(toSquares.has(F1)).toBe(false);
      expect(result.length).toBe(5);
    });

    test("king-side castling blocked by F1 attacked", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, F8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(G1)).toBe(false);
      expect(toSquares.has(C1)).toBe(true);
      expect(toSquares.has(F1)).toBe(false);
      expect(toSquares.has(F2)).toBe(false);
      expect(toSquares.has(D1)).toBe(true);
      expect(result.length).toBe(4);
    });

    test("no castling without rights", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = false;
        c.sides[0].canCastleQueenSide = false;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, E1, ctx);
      const toSquares = new Set(result.map((m) => m.to));
      expect(toSquares.has(G1)).toBe(false);
      expect(toSquares.has(C1)).toBe(false);
      expect(result.length).toBe(5);
    });

    test("non-king piece never generates castling", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getLegalMoves(moves, A1, ctx);
      for (const m of result) {
        expect(m.type).not.toBe(CASTLING);
      }
    });
  });

  describe("getAllLegalMoves", () => {
    test("only side-to-move pieces generate moves", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      for (const m of result) {
        expect(m.piece.color).toBe(WHITE);
      }
    });

    test("black to move only black pieces", () => {
      const ctx = turnFor(BLACK, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      for (const m of result) {
        expect(m.piece.color).toBe(BLACK);
      }
    });

    test("king in check only has king moves", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      for (const m of result) {
        expect(m.piece.type).toBe(KING);
        expect(m.to === D1 || m.to === F1 || m.to === D2 || m.to === F2).toBe(true);
      }
      expect(result.length).toBe(4);
    });

    test("checkmate has 0 moves", () => {
      const ctx = turnFor(BLACK, (c) => {
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        Board.place(c.board, G7, Square.create({ type: QUEEN, color: WHITE }));
        Board.place(c.board, F6, Square.create({ type: KING, color: WHITE }));
        c.sides[1].kingPosition = H8;
        c.sides[0].kingPosition = F6;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      expect(result.length).toBe(0);
    });

    test("stalemate has 0 moves", () => {
      const ctx = turnFor(BLACK, (c) => {
        Board.place(c.board, A1, Square.create({ type: KING, color: BLACK }));
        Board.place(c.board, B3, Square.create({ type: QUEEN, color: WHITE }));
        Board.place(c.board, C2, Square.create({ type: KING, color: WHITE }));
        c.sides[1].kingPosition = A1;
        c.sides[0].kingPosition = C2;
        c.sides[0].canCastleKingSide = false;
        c.sides[0].canCastleQueenSide = false;
        c.sides[1].canCastleKingSide = false;
        c.sides[1].canCastleQueenSide = false;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      expect(result.length).toBe(0);
    });

    test("pinned piece illegal moves excluded", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E2, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      for (const m of result) {
        if (m.piece.type === ROOK && m.from === E2) {
          expect(m.to === D2 || m.to === F2).toBe(false);
        }
      }
      expect(result.length).toBe(10);
    });

    test("castling moves included for the king", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[0].canCastleQueenSide = true;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      const hasKS = result.some((m) => m.from === E1 && m.to === G1);
      const hasQS = result.some((m) => m.from === E1 && m.to === C1);
      expect(hasKS).toBe(true);
      expect(hasQS).toBe(true);
    });

    test("en passant included when legal", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, D5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
        c.enPassantTarget = D6;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      const hasEP = result.some((m) => m.from === E5 && m.to === D6 && m.type === EN_PASSANT);
      expect(hasEP).toBe(true);
    });

    test("side with no pieces returns 0", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = NO_POSITION;
        c.sides[1].kingPosition = E8;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      expect(result.length).toBe(0);
    });

    test("side with only a king returns king's legal moves", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = false;
        c.sides[0].canCastleQueenSide = false;
        c.sides[1].kingPosition = E8;
        c.sides[1].canCastleKingSide = false;
        c.sides[1].canCastleQueenSide = false;
      });
      const moves: Move[] = [];
      const result = engine.getAllLegalMoves(moves, ctx);
      for (const m of result) {
        expect(m.piece.type).toBe(KING);
      }
      expect(result.length).toBe(5);
    });
  });

  describe("hasAnyLegalMoves", () => {
    test("at least one legal move returns true", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, B1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(true);
    });

    test("checkmate returns false", () => {
      const ctx = turnFor(BLACK, (c) => {
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        Board.place(c.board, G7, Square.create({ type: QUEEN, color: WHITE }));
        Board.place(c.board, F6, Square.create({ type: KING, color: WHITE }));
        c.sides[1].kingPosition = H8;
        c.sides[0].kingPosition = F6;
        c.sides[1].canCastleKingSide = false;
        c.sides[1].canCastleQueenSide = false;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(false);
    });

    test("stalemate returns false", () => {
      const ctx = turnFor(BLACK, (c) => {
        Board.place(c.board, A1, Square.create({ type: KING, color: BLACK }));
        Board.place(c.board, B3, Square.create({ type: QUEEN, color: WHITE }));
        Board.place(c.board, C2, Square.create({ type: KING, color: WHITE }));
        c.sides[1].kingPosition = A1;
        c.sides[0].kingPosition = C2;
        c.sides[1].canCastleKingSide = false;
        c.sides[1].canCastleQueenSide = false;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(false);
    });

    test("white stalemated black has moves, white to move returns false", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, A1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, B3, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(c.board, C2, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = A1;
        c.sides[1].kingPosition = C2;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(false);
    });

    test("same board black to move returns true", () => {
      const ctx = turnFor(BLACK, (c) => {
        Board.place(c.board, A1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, B3, Square.create({ type: QUEEN, color: BLACK }));
        Board.place(c.board, C2, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = A1;
        c.sides[1].kingPosition = C2;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(true);
    });

    test("side with no pieces returns false", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = NO_POSITION;
        c.sides[1].kingPosition = E8;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(false);
    });

    test("first piece blocked scan continues to next piece", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, A2, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, A3, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, B1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(true);
    });

    test("pinned piece doesn't prevent other pieces from moving", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E2, Square.create({ type: BISHOP, color: WHITE }));
        Board.place(c.board, B1, Square.create({ type: KNIGHT, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      expect(engine.hasAnyLegalMoves(ctx)).toBe(true);
    });
  });

  describe("isLegalMove", () => {
    test("normal legal move returns true", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E2, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const move: Move = {
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E4,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };
      expect(engine.isLegalMove(move, ctx)).toBe(true);
    });

    test("move exposing king returns false", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E2, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const move: Move = {
        piece: { type: ROOK, color: WHITE },
        from: E2,
        to: D2,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };
      expect(engine.isLegalMove(move, ctx)).toBe(false);
    });

    test("empty square returns false", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const move: Move = {
        piece: { type: PAWN, color: WHITE },
        from: E4,
        to: E5,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };
      expect(engine.isLegalMove(move, ctx)).toBe(false);
    });

    test("opponent piece returns false", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E7, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
      });
      const move: Move = {
        piece: { type: PAWN, color: BLACK },
        from: E7,
        to: E5,
        type: NORMAL,
        promoteTo: null,
        captured: null,
      };
      expect(engine.isLegalMove(move, ctx)).toBe(false);
    });

    test("legal castling returns true", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, H1, Square.create({ type: ROOK, color: WHITE }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[0].canCastleKingSide = true;
        c.sides[1].kingPosition = E8;
      });
      const move: Move = {
        piece: { type: KING, color: WHITE },
        from: E1,
        to: G1,
        type: CASTLING,
        promoteTo: null,
        captured: null,
      };
      expect(engine.isLegalMove(move, ctx)).toBe(true);
    });

    test("legal en passant returns true", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, E5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, D5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = E8;
        c.enPassantTarget = D6;
      });
      const move: Move = {
        piece: { type: PAWN, color: WHITE },
        from: E5,
        to: D6,
        type: EN_PASSANT,
        promoteTo: null,
        captured: { type: PAWN, color: BLACK },
      };
      expect(engine.isLegalMove(move, ctx)).toBe(true);
    });

    test("en passant exposing king returns false", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, H5, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, F5, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, E5, Square.create({ type: PAWN, color: BLACK }));
        Board.place(c.board, A5, Square.create({ type: ROOK, color: BLACK }));
        Board.place(c.board, E8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = H5;
        c.sides[1].kingPosition = E8;
        c.enPassantTarget = E6;
      });
      const move: Move = {
        piece: { type: PAWN, color: WHITE },
        from: F5,
        to: E6,
        type: EN_PASSANT,
        promoteTo: null,
        captured: { type: PAWN, color: BLACK },
      };
      expect(engine.isLegalMove(move, ctx)).toBe(false);
    });

    test("legal promotion returns true", () => {
      const ctx = turnFor(WHITE, (c) => {
        Board.place(c.board, E1, Square.create({ type: KING, color: WHITE }));
        Board.place(c.board, D7, Square.create({ type: PAWN, color: WHITE }));
        Board.place(c.board, H8, Square.create({ type: KING, color: BLACK }));
        c.sides[0].kingPosition = E1;
        c.sides[1].kingPosition = H8;
      });
      const move: Move = {
        piece: { type: PAWN, color: WHITE },
        from: D7,
        to: D8,
        type: PROMOTION,
        promoteTo: QUEEN,
        captured: null,
      };
      expect(engine.isLegalMove(move, ctx)).toBe(true);
    });
  });
});
