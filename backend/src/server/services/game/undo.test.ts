import { describe, expect, it, mock } from "bun:test";

import { Notifications } from "../../protocol/events";
import type { Game } from "../../store/game/game";
import type { GameReader } from "../../store/game/game-store";
import type { PlayerContext } from "../../types";
import {
  BLACK,
  err,
  GAME_NOT_FOUND,
  HUMAN_VS_HUMAN,
  NO_HISTORY,
  NOT_ALLOWED,
  NOT_YOUR_TURN,
  ok,
  PENDING_CONFLICT,
  type PieceColor,
  WHITE,
} from "../../types";
import { CONSENT_REQUEST } from "../../types/consent";
import { ConsentManager } from "../../util/consent";
import { UndoCommand } from "./undo";

describe("UndoCommand", () => {
  describe("request", () => {
    it("broadcasts to both players and returns ok when consent granted", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

      const result = cmd.request(ctx);

      expect(result).toEqual(ok());
      expect(broadcast).toHaveBeenCalledWith(Notifications.undoRequested("room-1", WHITE, expect.any(Number)));
    });

    it("returns err(NOT_ALLOWED) when game not active", () => {
      const game = { id: "room-1", broadcast: mock(() => {}), isActive: false } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(NOT_ALLOWED));
    });

    it("returns err(PENDING_CONFLICT) when already pending", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      consent.transition("room-1", CONSENT_REQUEST, BLACK);
      const cmd = new UndoCommand(games, consent);

      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(PENDING_CONFLICT));
    });

    it("returns err(NO_HISTORY) and never notifies either player when no move has been played yet", () => {
      const broadcast = mock(() => {});
      const game = { id: "room-1", broadcast, isActive: true, canUndo: false } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);

      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(NO_HISTORY));
      expect(broadcast).not.toHaveBeenCalled();
      expect(consent.isPending("room-1")).toBe(false);
    });

    it("returns err(GAME_NOT_FOUND) instead of throwing when the game has been swept from memory", () => {
      const games: GameReader = { get: mock((): Game | null => null), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(GAME_NOT_FOUND));
    });

    it("returns err(NOT_YOUR_TURN) when it's the requester's turn (rule 3)", () => {
      const game = {
        id: "room-1",
        broadcast: mock(() => {}),
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: WHITE,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      // WHITE is on turn, so they can't request — only the player who just moved can
      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(NOT_YOUR_TURN));
    });

    it("returns err(NOT_ALLOWED) when the ratchet has closed this point in history", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);

      // First request succeeds
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      // Resolve it (simulate a decline advancing the ratchet)
      consent.transition("room-1", CONSENT_REQUEST, WHITE); // re-stake consent for the resolve path
      cmd.decline({ playerId: "p2", roomId: "room-1", color: BLACK, mode: HUMAN_VS_HUMAN });

      // moveSeq hasn't advanced, so ratchet blocks
      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(NOT_ALLOWED));
    });

    it("accepts a new request after moveSeq advances past lastResolvedSeq", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);

      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());
      consent.transition("room-1", CONSENT_REQUEST, WHITE);
      cmd.decline({ playerId: "p2", roomId: "room-1", color: BLACK, mode: HUMAN_VS_HUMAN });

      // moveSeq advances (simulated)
      (game as { moveSeq: number }).moveSeq = 2;

      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(ok());
    });
  });

  describe("accept", () => {
    it("applies undo and broadcasts when consent valid", async () => {
      const broadcast = mock(() => {});
      const snapshot = { fen: "pos" };
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
        undo: mock(() => Promise.resolve(ok({}))),
        snapshot: mock(() => snapshot),
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      // WHITE requests (it's BLACK's turn, so WHITE just moved)
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      const result = await cmd.accept({ playerId: "p2", roomId: "room-1", color: BLACK, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(ok());
      expect(broadcast).toHaveBeenCalled();
    });

    it("returns err(PENDING_CONFLICT) when no pending request", async () => {
      const game = { id: "room-1", broadcast: mock(() => {}), isActive: true } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = await cmd.accept({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(PENDING_CONFLICT));
    });

    it("returns err(PENDING_CONFLICT) when accepting own request", async () => {
      const game = {
        id: "room-1",
        broadcast: mock(() => {}),
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      consent.transition("room-1", CONSENT_REQUEST, WHITE);
      const cmd = new UndoCommand(games, consent);

      const result = await cmd.accept({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(PENDING_CONFLICT));
    });

    it("propagates NOT_ALLOWED from Game.undo() instead of applying it, when the match ended by resignation/timeout/abandonment", async () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
        undo: mock(() => Promise.resolve(err(NOT_ALLOWED))),
        snapshot: mock(() => ({})),
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      // WHITE requests (this calls broadcast once for undo:requested)
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      (game as { isActive: boolean }).isActive = false;

      const result = await cmd.accept({ playerId: "p2", roomId: "room-1", color: BLACK, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(NOT_ALLOWED));
      // broadcast was called once for undo:requested, but NOT for undo:applied
      expect(broadcast).toHaveBeenCalledTimes(1);
    });

    it("returns err(GAME_NOT_FOUND) instead of throwing when the game has been swept from memory", async () => {
      const games: GameReader = { get: mock((): Game | null => null), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = await cmd.accept({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(GAME_NOT_FOUND));
    });
  });

  describe("decline", () => {
    it("broadcasts decline and returns ok when consent valid", () => {
      const broadcast = mock(() => {});
      const game = { id: "room-1", broadcast, moveSeq: 1 } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      consent.transition("room-1", CONSENT_REQUEST, BLACK);
      const cmd = new UndoCommand(games, consent);

      const result = cmd.decline({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(ok());
      expect(broadcast).toHaveBeenCalledWith(Notifications.undoDeclined("room-1", WHITE));
    });

    it("returns err(PENDING_CONFLICT) when no pending request", () => {
      const game = { id: "room-1", broadcast: mock(() => {}) } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = cmd.decline({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(PENDING_CONFLICT));
    });

    it("returns err(GAME_NOT_FOUND) instead of throwing when the game has been swept from memory", () => {
      const games: GameReader = { get: mock((): Game | null => null), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = cmd.decline({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(GAME_NOT_FOUND));
    });
  });

  describe("cancel", () => {
    it("broadcasts cancel and returns ok when consent valid", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      const result = cmd.cancel({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(ok());
      expect(broadcast).toHaveBeenCalledWith(Notifications.undoCancelled("room-1"));
    });

    it("returns err(PENDING_CONFLICT) when no pending request", () => {
      const game = { id: "room-1", broadcast: mock(() => {}) } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = cmd.cancel({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(PENDING_CONFLICT));
    });

    it("returns err(PENDING_CONFLICT) when opponent tries to cancel (only requester may cancel)", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      // WHITE requests — BLACK is the opponent
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      // BLACK (opponent) tries to cancel — must fail per rule 12
      const result = cmd.cancel({ playerId: "p2", roomId: "room-1", color: BLACK, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(PENDING_CONFLICT));
      expect(broadcast).not.toHaveBeenCalledWith(Notifications.undoCancelled("room-1"));
    });

    it("advances the ratchet so a follow-up request is blocked by rule 4", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      cmd.cancel({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      // moveSeq hasn't advanced, so ratchet blocks
      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
      expect(result).toEqual(err(NOT_ALLOWED));
    });

    it("returns err(GAME_NOT_FOUND) instead of throwing when the game has been swept from memory", () => {
      const games: GameReader = { get: mock((): Game | null => null), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      const result = cmd.cancel({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });

      expect(result).toEqual(err(GAME_NOT_FOUND));
    });
  });

  describe("onConsentExpired", () => {
    it("broadcasts undo:expired and advances the ratchet", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      cmd.onConsentExpired("room-1");

      expect(broadcast).toHaveBeenCalledWith(Notifications.undoExpired("room-1"));

      // ratchet advanced — follow-up request blocked
      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
      expect(result).toEqual(err(NOT_ALLOWED));
    });

    it("resolves the ratchet even when called from a stale timer callback", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      // decline resolves the request first, advancing the ratchet
      cmd.decline({ playerId: "p2", roomId: "room-1", color: BLACK, mode: HUMAN_VS_HUMAN });

      // stale timer callback fires — resolve() sees no pending stamp, idempotent
      cmd.onConsentExpired("room-1");

      // ratchet was already advanced by decline — follow-up request still blocked
      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
      expect(result).toEqual(err(NOT_ALLOWED));
    });
  });

  describe("invalidate", () => {
    it("broadcasts undo:invalidated to requester only and advances the ratchet", () => {
      const broadcast = mock(() => {});
      const notify = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        notify,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      cmd.invalidate("room-1");

      expect(notify).toHaveBeenCalledWith(WHITE, Notifications.undoInvalidated("room-1"));

      // ratchet advanced — follow-up request blocked
      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
      expect(result).toEqual(err(NOT_ALLOWED));
    });

    it("is a no-op when no request is pending", () => {
      const broadcast = mock(() => {});
      const game = { id: "room-1", broadcast } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const cmd = new UndoCommand(games, new ConsentManager());

      cmd.invalidate("room-1");

      expect(broadcast).not.toHaveBeenCalled();
    });

    it("sets lastResolvedSeq so a subsequent request after moveSeq advances succeeds", () => {
      const broadcast = mock(() => {});
      const notify = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        notify,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);
      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());

      cmd.invalidate("room-1");

      // moveSeq advances
      (game as { moveSeq: number }).moveSeq = 2;

      const result = cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
      expect(result).toEqual(ok());
    });
  });

  describe("clear", () => {
    it("removes pending stamp and frees consent slot", () => {
      const broadcast = mock(() => {});
      const game = {
        id: "room-1",
        broadcast,
        isActive: true,
        canUndo: true,
        moveSeq: 1,
        turn: BLACK,
      } as unknown as Game;
      const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
      const consent = new ConsentManager<string, PieceColor>();
      const cmd = new UndoCommand(games, consent);

      expect(cmd.request({ playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN })).toEqual(ok());
      expect(consent.isPending("room-1")).toBe(true);

      cmd.clear("room-1");

      expect(consent.isPending("room-1")).toBe(false);
      // moveSeq hasn't advanced, but clear() doesn't advance the ratchet —
      // it just cancels the pending request.
      // A new request will still fail the ratchet check, which is correct:
      // clear is for game-end/move-invalidation, not a free retry.
    });
  });
});
