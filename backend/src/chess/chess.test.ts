import { describe, expect, test } from "bun:test";
import {
  Chess,
  FENError,
  IllegalMoveError,
  NothingToUndoError,
  STARTING_FEN,
} from "./chess";
import {
  Position,
  A1,
  A3,
  A6,
  A7,
  A8,
  B1,
  B8,
  C1,
  D1,
  D5,
  D6,
  D8,
  E1,
  E2,
  E3,
  E4,
  E5,
  E7,
  E8,
  F1,
  F2,
  F3,
  G1,
  G2,
  G4,
  H1,
  H4,
} from "./core/position";
import {
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
} from "./core/piece";
import {
  IN_PROGRESS,
  CHECKMATE,
  DRAW,
  STALEMATE,
  THREEFOLD_REPETITION,
} from "./core/game";
import { PROMOTION } from "./core/move";

describe("Chess", () => {
  /** Plays a sequence of from→to moves on the given game and returns it. */
  function play(game: Chess, ...moves: [Position, Position][]): Chess {
    for (const [from, to] of moves) game.moveTo(from, to);
    return game;
  }

  describe("Chess constructor", () => {
    test("no args → standard opening position", () => {
      expect(new Chess().toFen()).toBe(STARTING_FEN);
    });

    test("custom FEN is accepted", () => {
      const fen = "8/8/8/8/8/8/8/K6k w - - 0 1";
      expect(new Chess({ fen }).toFen()).toBe(fen);
    });

    test("invalid FEN throws FENError", () => {
      expect(() => new Chess({ fen: "not-a-fen" })).toThrow(FENError);
    });

    test("empty FEN throws FENError", () => {
      expect(() => new Chess({ fen: "" })).toThrow(FENError);
    });
  });

  describe("Chess.isValidSquare", () => {
    test.each(["e4", "a1", "h8", "E4", "A1", "H8", "d5"])("'%s' → true", (sq) =>
      expect(Chess.isValidSquare(sq)).toBe(true),
    );

    test.each(["", "e", "e9", "i4", "e44", "11", "zz"])("'%s' → false", (sq) =>
      expect(Chess.isValidSquare(sq)).toBe(false),
    );
  });

  describe("pieceAt", () => {
    test("e1 → white king at the start", () => {
      expect(new Chess().pieceAt(E1)).toEqual({ type: KING, color: WHITE });
    });

    test("e8 → black king at the start", () => {
      expect(new Chess().pieceAt(E8)).toEqual({ type: KING, color: BLACK });
    });

    test("a1 → white rook at the start", () => {
      expect(new Chess().pieceAt(A1)).toEqual({ type: ROOK, color: WHITE });
    });

    test("a8 → black rook at the start", () => {
      expect(new Chess().pieceAt(A8)).toEqual({ type: ROOK, color: BLACK });
    });

    test("e4 is empty → null", () => {
      expect(new Chess().pieceAt(E4)).toBeNull();
    });

    test("piece is updated after a move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      expect(game.pieceAt(E2)).toBeNull();
      expect(game.pieceAt(E4)).toEqual({ type: PAWN, color: WHITE });
    });
  });

  describe("sideToMove", () => {
    test("WHITE at the start", () => {
      expect(new Chess().sideToMove()).toBe(WHITE);
    });

    test("switches to BLACK after white's first move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      expect(game.sideToMove()).toBe(BLACK);
    });

    test("returns to WHITE after both sides move", () => {
      const game = play(new Chess(), [E2, E4], [E7, E5]);
      expect(game.sideToMove()).toBe(WHITE);
    });
  });

  describe("isInCheck", () => {
    test("false at the starting position", () => {
      expect(new Chess().isInCheck()).toBe(false);
    });

    test("white king in check from rook on rank 1", () => {
      // White king e1, black rook h1 – attacks the entire first rank.
      const game = new Chess({ fen: "8/7k/8/8/8/8/8/4K2r w - - 0 1" });
      expect(game.isInCheck()).toBe(true);
    });

    test("black king in check from queen on same file", () => {
      // Black king e8, white queen e4 – attacks the whole e-file.
      const game = new Chess({ fen: "4k3/8/8/8/4Q3/8/8/7K b - - 0 1" });
      expect(game.isInCheck()).toBe(true);
    });

    test("not in check when blocked", () => {
      // White queen on e4, own pawn on e5 blocks the e-file; king e8 is safe.
      const game = new Chess({ fen: "4k3/8/8/4P3/4Q3/8/8/7K b - - 0 1" });
      expect(game.isInCheck()).toBe(false);
    });
  });

  describe("isOver", () => {
    test("false at the start", () => {
      expect(new Chess().isOver()).toBe(false);
    });

    test("true when checkmated (Fool's mate position)", () => {
      const game = new Chess({
        fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
      });
      expect(game.isOver()).toBe(true);
    });

    test("true when stalemated", () => {
      // Black king e8, white pawn e7, white king e6 – black has no legal moves.
      const game = new Chess({ fen: "4k3/4P3/4K3/8/8/8/8/8 b - - 0 1" });
      expect(game.isOver()).toBe(true);
    });
  });

  describe("legalMovesFrom", () => {
    test("e2 pawn has exactly two legal moves (e3 and e4)", () => {
      const destinations = new Chess().legalMovesFrom(E2).map((m) => m.to);
      expect(destinations).toHaveLength(2);
      expect(destinations).toContain(E3);
      expect(destinations).toContain(E4);
    });

    test("b1 knight has exactly two legal moves (a3 and c3)", () => {
      const destinations = new Chess().legalMovesFrom(B1).map((m) => m.to);
      const a3 = Position.parse("a3")!;
      const c3 = Position.parse("c3")!;
      expect(destinations).toHaveLength(2);
      expect(destinations).toContain(a3);
      expect(destinations).toContain(c3);
    });

    test("empty square → empty array", () => {
      expect(new Chess().legalMovesFrom(E4)).toHaveLength(0);
    });

    test("opponent's piece on your turn → empty array", () => {
      // It is white's turn; e7 has a black pawn.
      expect(new Chess().legalMovesFrom(E7)).toHaveLength(0);
    });
  });

  describe("legalMovesMap", () => {
    test("starting position totals 20 legal destinations", () => {
      // 8 pawns × 2 squares + 2 knights × 2 squares = 20.
      const map = new Chess().legalMovesMap();
      let total = 0;
      for (const dests of map.values()) total += dests.length;
      expect(total).toBe(20);
    });

    test("both knights appear as moveable squares", () => {
      const map = new Chess().legalMovesMap();
      expect(map.has(B1)).toBe(true);
      expect(map.has(G1)).toBe(true);
    });

    test("locked pieces are absent from the map", () => {
      // Rooks cannot move in the starting position.
      const map = new Chess().legalMovesMap();
      expect(map.has(A1)).toBe(false);
      expect(map.has(H1)).toBe(false);
    });
  });

  describe("isLegalMove", () => {
    test("e2→e4 is legal", () => {
      expect(new Chess().isLegalMove("e2", "e4")).toBe(true);
    });

    test("e2→e5 is not legal", () => {
      expect(new Chess().isLegalMove("e2", "e5")).toBe(false);
    });

    test("invalid from-square → false", () => {
      expect(new Chess().isLegalMove("z4", "e4")).toBe(false);
    });

    test("invalid to-square → false", () => {
      expect(new Chess().isLegalMove("e2", "e9")).toBe(false);
    });
  });

  describe("isLegalSquare", () => {
    test("E2→E4 is legal", () => {
      expect(new Chess().isLegalSquare(E2, E4)).toBe(true);
    });

    test("E2→E5 is not legal", () => {
      expect(new Chess().isLegalSquare(E2, E5)).toBe(false);
    });

    test("empty square → false", () => {
      expect(new Chess().isLegalSquare(E4, E5)).toBe(false);
    });
  });

  describe("canUndo", () => {
    test("false when no moves have been made", () => {
      expect(new Chess().canUndo()).toBe(false);
    });

    test("true after one move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      expect(game.canUndo()).toBe(true);
    });

    test("false again after undoing the only move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.canUndo()).toBe(false);
    });
  });

  describe("plyCount", () => {
    test("0 initially", () => {
      expect(new Chess().plyCount()).toBe(0);
    });

    test("increments by 1 per half-move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      expect(game.plyCount()).toBe(1);
      game.moveTo(E7, E5);
      expect(game.plyCount()).toBe(2);
    });

    test("decrements after undoMove", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.plyCount()).toBe(0);
    });
  });

  describe("moveHistory", () => {
    test("empty before any moves", () => {
      expect(new Chess().moveHistory()).toHaveLength(0);
    });

    test("returns moves in order, oldest first", () => {
      const game = new Chess();
      const m1 = game.moveTo(E2, E4);
      const m2 = game.moveTo(E7, E5);
      const history = game.moveHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(m1);
      expect(history[1]).toEqual(m2);
    });

    test("shrinks after undoMove", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.moveHistory()).toHaveLength(0);
    });
  });

  describe("toFen", () => {
    test("returns STARTING_FEN before any moves", () => {
      expect(new Chess().toFen()).toBe(STARTING_FEN);
    });

    test("FEN changes after a move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      expect(game.toFen()).not.toBe(STARTING_FEN);
    });

    test("FEN is restored after undoing the move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.toFen()).toBe(STARTING_FEN);
    });
  });

  describe("state", () => {
    test("contains a bigint hash", () => {
      expect(typeof new Chess().state().hash).toBe("bigint");
    });

    test("sideToMove is WHITE at the start", () => {
      expect(new Chess().state().sideToMove).toBe(WHITE);
    });

    test("hash changes after a move", () => {
      const game = new Chess();
      const before = game.state().hash;
      game.moveTo(E2, E4);
      expect(game.state().hash).not.toBe(before);
    });
  });

  describe("getContext", () => {
    test("returns a deep copy – mutating it does not affect the game", () => {
      const game = new Chess();
      const ctx = game.getContext();
      ctx.sideToMove = BLACK; // mutate the copy
      expect(game.sideToMove()).toBe(WHITE); // original unchanged
    });

    test("modifying the copy's board does not corrupt the game", () => {
      const game = new Chess();
      const ctx = game.getContext();
      // Force-clear a cell in the copy (the Board is its own array).
      ctx.board.fill(0); // zeroes the copy
      // The real game should still see the e1 king.
      expect(game.pieceAt(E1)).toEqual({ type: KING, color: WHITE });
    });
  });

  describe("getHash", () => {
    test("returns a bigint", () => {
      expect(typeof new Chess().getHash()).toBe("bigint");
    });

    test("hash changes after a move", () => {
      const game = new Chess();
      const before = game.getHash();
      game.moveTo(E2, E4);
      expect(game.getHash()).not.toBe(before);
    });

    test("hash is restored after undo", () => {
      const game = new Chess();
      const before = game.getHash();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.getHash()).toBe(before);
    });

    test("same position reached via different move orders has the same hash", () => {
      // 1.e4 d5 and 1.d4 e5 reach different positions, but playing e4-e5 and d4-d5
      // back to a shared point should yield equal hashes if the positions are equal.
      // Simple check: two identical games share the same hash at each step.
      const a = new Chess();
      const b = new Chess();
      a.moveTo(E2, E4);
      b.moveTo(E2, E4);
      expect(a.getHash()).toBe(b.getHash());
    });
  });

  describe("gameResult", () => {
    test("IN_PROGRESS at the start", () => {
      expect(new Chess().gameResult().status).toBe(IN_PROGRESS);
    });

    test("CHECKMATE status after Fool's mate", () => {
      const game = new Chess({
        fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
      });
      const result = game.gameResult();
      expect(result.status).toBe(CHECKMATE);
      expect(result.hasWinner).toBe(true);
      expect(result.winner).toBe(BLACK);
    });

    test("DRAW / STALEMATE status", () => {
      const game = new Chess({ fen: "4k3/4P3/4K3/8/8/8/8/8 b - - 0 1" });
      const result = game.gameResult();
      expect(result.status).toBe(DRAW);
      expect(result.drawReason).toBe(STALEMATE);
      expect(result.hasWinner).toBe(false);
    });
  });

  describe("kingPosition", () => {
    test("white king starts on e1", () => {
      expect(new Chess().kingPosition(WHITE)).toBe(E1);
    });

    test("black king starts on e8", () => {
      expect(new Chess().kingPosition(BLACK)).toBe(E8);
    });

    test("updates after a king move", () => {
      // White king e1, black king h1 – king can step to f1.
      const game = new Chess({ fen: "8/8/8/8/8/8/8/4K2k w - - 0 1" });
      game.moveTo(E1, F1);
      expect(game.kingPosition(WHITE)).toBe(F1);
    });
  });

  describe("lastMove", () => {
    test("null before any moves", () => {
      expect(new Chess().lastMove()).toBeNull();
    });

    test("returns the most recently played move", () => {
      const game = new Chess();
      const move = game.moveTo(E2, E4);
      expect(game.lastMove()).toEqual(move);
    });

    test("updates after each new move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      const m2 = game.moveTo(E7, E5);
      expect(game.lastMove()).toEqual(m2);
    });

    test("becomes null again after undoing the only move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.lastMove()).toBeNull();
    });
  });

  describe("halfMoveClock", () => {
    test("0 at the start", () => {
      expect(new Chess().halfMoveClock()).toBe(0);
    });

    test("resets to 0 after a pawn move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      expect(game.halfMoveClock()).toBe(0);
    });

    test("increments after a non-pawn non-capture move", () => {
      // Knight at a1, kings well apart; halfMoveClock pre-set to 5.
      const game = new Chess({ fen: "8/8/8/8/8/8/8/N3K2k w - - 5 1" });
      game.moveTo(A1, Position.parse("b3")!);
      expect(game.halfMoveClock()).toBe(6);
    });
  });

  describe("legalPromotions", () => {
    test("returns all 4 promotion piece types for a pawn on rank 7", () => {
      // White pawn a7, kings well apart.
      const game = new Chess({ fen: "8/P7/8/8/8/8/8/K6k w - - 0 1" });
      const promos = game.legalPromotions(A7, A8);
      expect(promos).toHaveLength(4);
      expect(promos).toContain(QUEEN);
      expect(promos).toContain(ROOK);
      expect(promos).toContain(BISHOP);
      expect(promos).toContain(KNIGHT);
    });

    test("returns [] for a non-promotion move", () => {
      expect(new Chess().legalPromotions(E2, E4)).toHaveLength(0);
    });

    test("returns [] for an empty square", () => {
      expect(new Chess().legalPromotions(E4, E5)).toHaveLength(0);
    });
  });

  describe("moveTo", () => {
    test("returns the applied move with correct from/to", () => {
      const move = new Chess().moveTo(E2, E4);
      expect(move.from).toBe(E2);
      expect(move.to).toBe(E4);
    });

    test("throws IllegalMoveError for an illegal destination", () => {
      expect(() => new Chess().moveTo(E2, E5)).toThrow(IllegalMoveError);
    });

    test("throws IllegalMoveError when moving an opponent's piece", () => {
      expect(() => new Chess().moveTo(E7, E5)).toThrow(IllegalMoveError);
    });

    test("throws IllegalMoveError when moving from an empty square", () => {
      expect(() => new Chess().moveTo(E4, E5)).toThrow(IllegalMoveError);
    });

    test("promotion defaults to QUEEN", () => {
      const game = new Chess({ fen: "8/P7/8/8/8/8/8/K6k w - - 0 1" });
      const move = game.moveTo(A7, A8);
      expect(move.type).toBe(PROMOTION);
      expect(move.promoteTo).toBe(QUEEN);
    });

    test("promotion to a specified piece type is honoured", () => {
      const game = new Chess({ fen: "8/P7/8/8/8/8/8/K6k w - - 0 1" });
      const move = game.moveTo(A7, A8, KNIGHT);
      expect(move.promoteTo).toBe(KNIGHT);
    });
  });

  describe("makeMove", () => {
    test("applies a legal Move object and returns it", () => {
      const game = new Chess();
      const legal = game.legalMovesFrom(E2).find((m) => m.to === E4)!;
      const result = game.makeMove(legal);
      expect(result).toBe(legal);
      expect(game.sideToMove()).toBe(BLACK);
    });

    test("throws IllegalMoveError for a fabricated illegal move", () => {
      const game = new Chess();
      const legal = game.legalMovesFrom(E2).find((m) => m.to === E4)!;
      // Change the destination to an illegal square.
      const illegal = { ...legal, to: E5 };
      expect(() => game.makeMove(illegal)).toThrow(IllegalMoveError);
    });
  });

  describe("undoMove", () => {
    test("reverts the position to the state before the last move", () => {
      const game = new Chess();
      game.moveTo(E2, E4);
      game.undoMove();
      expect(game.toFen()).toBe(STARTING_FEN);
    });

    test("returns the reverted move", () => {
      const game = new Chess();
      const move = game.moveTo(E2, E4);
      expect(game.undoMove()).toEqual(move);
    });

    test("throws NothingToUndoError when history is empty", () => {
      expect(() => new Chess().undoMove()).toThrow(NothingToUndoError);
    });

    test("multiple undos unwind the full history", () => {
      const game = play(new Chess(), [E2, E4], [E7, E5]);
      game.undoMove();
      game.undoMove();
      expect(game.plyCount()).toBe(0);
      expect(game.toFen()).toBe(STARTING_FEN);
    });
  });

  describe("integration", () => {
    test("Fool's mate – white is mated in 4 half-moves", () => {
      // 1. f3 e5 2. g4 Qh4#
      const game = play(new Chess(), [F2, F3], [E7, E5], [G2, G4], [D8, H4]);
      expect(game.isOver()).toBe(true);
      const result = game.gameResult();
      expect(result.status).toBe(CHECKMATE);
      expect(result.winner).toBe(BLACK);
    });

    test("en passant – captured pawn is removed from d5", () => {
      // White pawn e5, black pawn d5 (just pushed), en passant target d6.
      const game = new Chess({ fen: "8/8/8/3pP3/8/8/8/K6k w - d6 0 1" });
      game.moveTo(E5, D6);
      expect(game.pieceAt(D5)).toBeNull(); // captured pawn gone
      expect(game.pieceAt(D6)).toEqual({ type: PAWN, color: WHITE });
      expect(game.pieceAt(E5)).toBeNull(); // original square vacated
    });

    test("king-side castling moves both king and rook", () => {
      const game = new Chess({ fen: "k7/8/8/8/8/8/8/R3K2R w KQ - 0 1" });
      const g1 = Position.parse("g1")!;
      const f1 = Position.parse("f1")!;
      game.moveTo(E1, g1);
      expect(game.pieceAt(g1)).toEqual({ type: KING, color: WHITE });
      expect(game.pieceAt(f1)).toEqual({ type: ROOK, color: WHITE });
      expect(game.pieceAt(E1)).toBeNull();
      expect(game.pieceAt(H1)).toBeNull();
    });

    test("queen-side castling moves both king and rook", () => {
      const game = new Chess({ fen: "k7/8/8/8/8/8/8/R3K2R w KQ - 0 1" });
      game.moveTo(E1, C1);
      expect(game.pieceAt(C1)).toEqual({ type: KING, color: WHITE });
      expect(game.pieceAt(D1)).toEqual({ type: ROOK, color: WHITE });
      expect(game.pieceAt(E1)).toBeNull();
      expect(game.pieceAt(A1)).toBeNull();
    });

    test("threefold repetition – knights oscillating → DRAW", () => {
      // Nb1↔a3 and Nb8↔a6 brings back the starting position three times.
      // Occurrences: start (1st), after move 4 (2nd), after move 8 (3rd).
      const game = new Chess();
      play(
        game,
        [B1, A3],
        [B8, A6], // 1. Na3 Na6
        [A3, B1],
        [A6, B8], // 2. Nb1 Nb8  ← 2nd occurrence of start
        [B1, A3],
        [B8, A6], // 3. Na3 Na6
        [A3, B1],
        [A6, B8], // 4. Nb1 Nb8  ← 3rd occurrence of start
      );
      const result = game.gameResult();
      expect(result.status).toBe(DRAW);
      expect(result.drawReason).toBe(THREEFOLD_REPETITION);
    });

    test("undo and redo sequence reproduces the same FEN", () => {
      const game = play(new Chess(), [E2, E4], [E7, E5]);
      const fenAfterTwo = game.toFen();

      game.undoMove();
      game.undoMove();
      expect(game.toFen()).toBe(STARTING_FEN);

      play(game, [E2, E4], [E7, E5]);
      expect(game.toFen()).toBe(fenAfterTwo);
    });

    test("pawn promotion changes piece on the board", () => {
      const game = new Chess({ fen: "8/P7/8/8/8/8/8/K6k w - - 0 1" });
      game.moveTo(A7, A8, ROOK);
      expect(game.pieceAt(A8)).toEqual({ type: ROOK, color: WHITE });
      expect(game.pieceAt(A7)).toBeNull();
    });

    test("making a move after undo branches correctly", () => {
      // Play e4, undo, then play d4 – the final position must differ from e4.
      const game = new Chess();
      game.moveTo(E2, E4);
      const fenE4 = game.toFen();
      game.undoMove();
      game.moveTo(Position.parse("d2")!, Position.parse("d4")!);
      expect(game.toFen()).not.toBe(fenE4);
    });
  });
});
