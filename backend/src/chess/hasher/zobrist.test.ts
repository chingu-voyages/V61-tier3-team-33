import { describe, expect, test } from "bun:test";

import { MoveHash } from "../core/hash";
import type { Move } from "../core/move";
import { CASTLING, EN_PASSANT, NORMAL, PROMOTION } from "../core/move";
import { BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from "../core/piece";
import { B1, C1, C3, D5, D6, D8, E1, E2, E3, E4, E5, E7, E8, F3, G1, H1, H5 } from "../core/position";
import type { TurnContext } from "../core/state";
import { getDefaultEngine } from "../engine/default";
import { getDefaultParser } from "../parser/default";
import { getDefaultHasher } from "./default";

describe("Zobrist", () => {
  const hasher = getDefaultHasher();
  const engine = getDefaultEngine();
  const parser = getDefaultParser();

  function decode(fen: string): TurnContext {
    const [ctx, err] = parser.decode(fen);
    expect(err).toBeNull();
    return ctx!;
  }

  function roundTrip(ctx: TurnContext, move: Move) {
    const originalHash = hasher.initHash(ctx);

    const snap = engine.apply(ctx, move);
    const moveHash = MoveHash.create(snap, ctx);
    const advancedHash = hasher.hash(originalHash, moveHash);

    const revertedHash = hasher.hash(advancedHash, moveHash);
    engine.undo(ctx, snap);

    expect(revertedHash).toBe(originalHash);

    const restoredHash = hasher.initHash(ctx);
    expect(restoredHash).toBe(originalHash);
  }

  describe("initHash", () => {
    test("non-zero for the starting position", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      expect(hasher.initHash(ctx)).not.toBe(0n);
    });

    test("deterministic — same position always produces the same hash", () => {
      const ctx1 = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const ctx2 = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      expect(hasher.initHash(ctx1)).toBe(hasher.initHash(ctx2));
    });

    test("differs when the side to move differs", () => {
      const ctxWhite = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const ctxBlack = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1");
      expect(hasher.initHash(ctxWhite)).not.toBe(hasher.initHash(ctxBlack));
    });

    test("differs when castling rights differ", () => {
      const ctxFull = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const ctxNone = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1");
      expect(hasher.initHash(ctxFull)).not.toBe(hasher.initHash(ctxNone));
    });

    test("differs when en passant target differs", () => {
      const ctxEP = decode("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
      const ctxNoEP = decode("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
      expect(hasher.initHash(ctxEP)).not.toBe(hasher.initHash(ctxNoEP));
    });

    test("differs when a piece is in a different square", () => {
      const ctx1 = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const ctx2 = decode("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1");
      expect(hasher.initHash(ctx1)).not.toBe(hasher.initHash(ctx2));
    });
  });

  describe("hash round-trip", () => {
    test("a normal pawn push round-trips", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      roundTrip(ctx, {
        type: NORMAL,
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E3,
        promoteTo: null,
        captured: null,
      });
    });

    test("a normal knight move round-trips", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      roundTrip(ctx, {
        type: NORMAL,
        piece: { type: KNIGHT, color: WHITE },
        from: B1,
        to: C3,
        promoteTo: null,
        captured: null,
      });
    });

    test("a capture round-trips", () => {
      const ctx = decode("4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1");
      roundTrip(ctx, {
        type: NORMAL,
        piece: { type: KNIGHT, color: WHITE },
        from: C3,
        to: D5,
        promoteTo: null,
        captured: { type: PAWN, color: BLACK },
      });
    });

    test("a double pawn push (sets EP target) round-trips", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      roundTrip(ctx, {
        type: NORMAL,
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E4,
        promoteTo: null,
        captured: null,
      });
    });

    test("an en passant capture round-trips", () => {
      const ctx = decode("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2");
      roundTrip(ctx, {
        type: EN_PASSANT,
        piece: { type: PAWN, color: WHITE },
        from: E5,
        to: D6,
        promoteTo: null,
        captured: { type: PAWN, color: BLACK },
      });
    });

    test("a king-side castling round-trips", () => {
      const ctx = decode("rnbqk2r/pppppppp/5bn1/8/8/5BN1/PPPPPPPP/RNBQK2R w KQkq - 4 4");
      roundTrip(ctx, {
        type: CASTLING,
        piece: { type: KING, color: WHITE },
        from: E1,
        to: G1,
        promoteTo: null,
        captured: null,
      });
    });

    test("a queen-side castling round-trips", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1");
      roundTrip(ctx, {
        type: CASTLING,
        piece: { type: KING, color: WHITE },
        from: E1,
        to: C1,
        promoteTo: null,
        captured: null,
      });
    });

    test("a promotion (no capture) round-trips", () => {
      const ctx = decode("k7/4P3/8/8/8/8/8/4K3 w - - 0 1");
      roundTrip(ctx, {
        type: PROMOTION,
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: E8,
        promoteTo: QUEEN,
        captured: null,
      });
    });

    test("a promotion with capture round-trips", () => {
      const ctx = decode("3rk3/4P3/8/8/8/8/8/4K3 w - - 0 1");
      roundTrip(ctx, {
        type: PROMOTION,
        piece: { type: PAWN, color: WHITE },
        from: E7,
        to: D8,
        promoteTo: QUEEN,
        captured: { type: ROOK, color: BLACK },
      });
    });

    test("a rook move that forfeits castling rights round-trips", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
      roundTrip(ctx, {
        type: NORMAL,
        piece: { type: ROOK, color: WHITE },
        from: H1,
        to: H5,
        promoteTo: null,
        captured: null,
      });
    });

    test("a king move that forfeits both castling rights round-trips", () => {
      const ctx = decode("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
      roundTrip(ctx, {
        type: NORMAL,
        piece: { type: KING, color: WHITE },
        from: E1,
        to: E2,
        promoteTo: null,
        captured: null,
      });
    });
  });

  describe("multi-move sequence", () => {
    test("a sequence of moves and undos preserves the hash", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const originalHash = hasher.initHash(ctx);

      const moves: Move[] = [
        {
          type: NORMAL,
          piece: { type: PAWN, color: WHITE },
          from: E2,
          to: E4,
          promoteTo: null,
          captured: null,
        },
        {
          type: NORMAL,
          piece: { type: PAWN, color: BLACK },
          from: E7,
          to: E5,
          promoteTo: null,
          captured: null,
        },
        {
          type: NORMAL,
          piece: { type: KNIGHT, color: WHITE },
          from: G1,
          to: F3,
          promoteTo: null,
          captured: null,
        },
      ];

      const snapshots: ReturnType<typeof engine.apply>[] = [];
      let currentHash = originalHash;

      for (const move of moves) {
        const snap = engine.apply(ctx, move);
        snapshots.push(snap);
        const moveHash = MoveHash.create(snap, ctx);
        currentHash = hasher.hash(currentHash, moveHash);
      }

      for (const snap of snapshots.toReversed()) {
        const moveHash = MoveHash.create(snap, ctx);
        currentHash = hasher.hash(currentHash, moveHash);
        engine.undo(ctx, snap);
      }

      expect(currentHash).toBe(originalHash);

      const restoredHash = hasher.initHash(ctx);
      expect(restoredHash).toBe(originalHash);
    });
  });

  describe("transposition", () => {
    test("same position via different move orders has the same hash", () => {
      const fen = "4k3/8/8/8/8/8/8/1N1QK1N1 w - - 0 1";

      const ctx1 = decode(fen);
      const h1Start = hasher.initHash(ctx1);
      const snap1a = engine.apply(ctx1, {
        type: NORMAL,
        piece: { type: KNIGHT, color: WHITE },
        from: B1,
        to: C3,
        promoteTo: null,
        captured: null,
      });
      const h1AfterNc3 = hasher.hash(h1Start, MoveHash.create(snap1a, ctx1));
      const snap1b = engine.apply(ctx1, {
        type: NORMAL,
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
        promoteTo: null,
        captured: null,
      });
      const h1Final = hasher.hash(h1AfterNc3, MoveHash.create(snap1b, ctx1));

      const ctx2 = decode(fen);
      const h2Start = hasher.initHash(ctx2);
      const snap2a = engine.apply(ctx2, {
        type: NORMAL,
        piece: { type: KNIGHT, color: WHITE },
        from: G1,
        to: F3,
        promoteTo: null,
        captured: null,
      });
      const h2AfterNf3 = hasher.hash(h2Start, MoveHash.create(snap2a, ctx2));
      const snap2b = engine.apply(ctx2, {
        type: NORMAL,
        piece: { type: KNIGHT, color: WHITE },
        from: B1,
        to: C3,
        promoteTo: null,
        captured: null,
      });
      const h2Final = hasher.hash(h2AfterNf3, MoveHash.create(snap2b, ctx2));

      expect(h1Final).toBe(h2Final);
    });
  });

  describe("en passant target edge case", () => {
    test("a double pawn push then its undo restores the exact original hash", () => {
      const ctx = decode("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      const originalHash = hasher.initHash(ctx);

      const move: Move = {
        type: NORMAL,
        piece: { type: PAWN, color: WHITE },
        from: E2,
        to: E4,
        promoteTo: null,
        captured: null,
      };
      const snap = engine.apply(ctx, move);
      const moveHash = MoveHash.create(snap, ctx);
      const afterHash = hasher.hash(originalHash, moveHash);

      expect(afterHash).not.toBe(originalHash);

      const revertedHash = hasher.hash(afterHash, moveHash);
      engine.undo(ctx, snap);

      expect(revertedHash).toBe(originalHash);
    });
  });
});
