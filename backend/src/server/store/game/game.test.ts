import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  A1,
  A6,
  B6,
  D5,
  D6,
  D7,
  D8,
  E2,
  E3,
  E4,
  E5,
  E7,
  F2,
  F3,
  F6,
  G1,
  G2,
  G4,
  G8,
  H4,
  type PieceColor,
} from "../../../chess";
import { Chess } from "../../../chess";
import type { Clock } from "../../clock/clock";
import type { Timer } from "../../clock/timer";
import type { Publisher } from "../../events/hub";
import type { Occupant } from "../../occupant/occupant";
import { MOVE_MADE, type Notification, ROOM_LEFT } from "../../protocol/events";
import { DEFAULT, MOVE } from "../../types";
import {
  ABANDONED,
  ACTIVE,
  BLACK,
  CHECKMATE,
  DRAW,
  FIFTY_MOVE_RULE,
  FINISHED,
  HUMAN,
  HUMAN_VS_HUMAN,
  INSUFFICIENT_MATERIAL,
  RESIGNATION,
  RULES,
  STALEMATE,
  THREEFOLD_REPETITION,
  TIMEOUT,
  WAITING,
  WHITE,
} from "../../types";
import {
  GAME_OVER,
  ILLEGAL_MOVE,
  INVALID_MODE,
  NO_HISTORY,
  NOT_ALLOWED,
  NOT_YOUR_PIECE,
  NOT_YOUR_TURN,
  ROOM_FULL,
  SQUARE_EMPTY,
} from "../../types";
import { Game } from "./game";

describe("Game", () => {
  afterEach(() => {});

  function makeOccupant(playerId: string): Occupant {
    return { kind: HUMAN, playerId, notify: mock(() => {}) };
  }

  function makePublisher() {
    return { emit: mock(() => {}) } satisfies Publisher;
  }

  /** A mock per-move Clock strategy: onMove resets to initialMs, no delay. */
  function mockClock(initialMs = 300_000): Clock {
    return {
      type: MOVE,
      format: DEFAULT,
      initialMs,
      onMove: () => initialMs,
      onTurn: () => 0,
    };
  }

  /** A mock Timer that records calls without real ticking. */
  function makeMockTimer(): Timer {
    return {
      strategy: mockClock(),
      state: { whiteMs: 0, blackMs: 0, active: null },
      start: mock(() => {}),
      stop: mock(() => 0),
      startNext: mock(() => {}),
      dispose: mock(() => {}),
    };
  }

  /** A stateful mock Timer that tracks active and remaining times. */
  function makeStatefulTimer(
    initialMs = 300_000,
  ): Timer & { _active: PieceColor | null; _whiteMs: number; _blackMs: number } {
    const t = {
      _active: null as PieceColor | null,
      _whiteMs: initialMs,
      _blackMs: initialMs,
      strategy: mockClock(),
      get state() {
        return { whiteMs: t._whiteMs, blackMs: t._blackMs, active: t._active };
      },
      start: mock((_whiteMs: number, _blackMs: number, color: PieceColor) => {
        t._active = color;
      }),
      stop: mock((color: PieceColor) => {
        t._active = null;
        return t[color === WHITE ? "_whiteMs" : "_blackMs"];
      }),
      startNext: mock((color: PieceColor) => {
        t._active = color;
      }),
      dispose: mock(() => {
        t._active = null;
      }),
    };
    return t;
  }

  function makeGame(publisher: Publisher = makePublisher(), timer: Timer = makeMockTimer()) {
    return new Game("game-1", HUMAN_VS_HUMAN, mockClock(), publisher, timer);
  }

  /** Seats two occupants so the game goes ACTIVE, returning both. */
  function seatBothPlayers(game: Game) {
    const white = makeOccupant("white-player");
    const black = makeOccupant("black-player");
    game.join(WHITE, white);
    game.join(BLACK, black);
    return { white, black };
  }

  /** Plays Fool's Mate (1. f3 e5 2. g4 Qh4#) so a real checkmate occurs. */
  async function playFoolsMate(game: Game) {
    await game.move(WHITE, { from: F2, to: F3 });
    await game.move(BLACK, { from: E7, to: E5 });
    await game.move(WHITE, { from: G2, to: G4 });
    return game.move(BLACK, { from: D8, to: H4 });
  }

  describe("initial state", () => {
    it("starts WAITING, not full, not finished, with no end reason", () => {
      const game = makeGame();

      expect(game.status).toBe(WAITING);
      expect(game.endReason).toBeNull();
      expect(game.isFull).toBe(false);
      expect(game.isFinished).toBe(false);
    });

    it("carries the id and mode passed to the constructor", () => {
      const game = new Game("room-42", HUMAN_VS_HUMAN, mockClock(), makePublisher(), makeMockTimer());

      expect(game.id).toBe("room-42");
      expect(game.mode).toBe(HUMAN_VS_HUMAN);
    });
  });

  describe("nextColor", () => {
    it("offers WHITE first, then BLACK, then null once full", () => {
      const game = makeGame();

      expect(game.nextColor()).toBe(WHITE);
      game.join(WHITE, makeOccupant("p1"));

      expect(game.nextColor()).toBe(BLACK);
      game.join(BLACK, makeOccupant("p2"));

      expect(game.nextColor()).toBeNull();
    });
  });

  describe("getOccupant / playerIdByColor", () => {
    it("returns null for an empty slot", () => {
      const game = makeGame();

      expect(game.getOccupant(WHITE)).toBeNull();
      expect(game.playerIdByColor(WHITE)).toBeNull();
    });

    it("returns the seated occupant and their playerId", () => {
      const game = makeGame();
      const white = makeOccupant("white-player");

      game.join(WHITE, white);

      expect(game.getOccupant(WHITE)).toBe(white);
      expect(game.playerIdByColor(WHITE)).toBe("white-player");
    });
  });

  describe("join", () => {
    it("seats an occupant and returns ok", () => {
      const game = makeGame();
      const result = game.join(WHITE, makeOccupant("p1"));

      expect(result.ok).toBe(true);
      expect(game.isFull).toBe(false);
    });

    it("goes ACTIVE once the second color joins", () => {
      const game = makeGame();

      game.join(WHITE, makeOccupant("p1"));
      expect(game.status).toBe(WAITING);

      game.join(BLACK, makeOccupant("p2"));
      expect(game.status).toBe(ACTIVE);
      expect(game.isFull).toBe(true);
    });

    it("rejects joining a color slot that's already taken", () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1"));

      const result = game.join(WHITE, makeOccupant("p2"));

      expect(result).toEqual({ ok: false, error: ROOM_FULL });
    });

    it("rejects joining once the game has finished", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);

      const result = game.join(WHITE, makeOccupant("late-comer"));

      expect(result).toEqual({ ok: false, error: INVALID_MODE });
    });
  });

  describe("reseat", () => {
    it("replaces the occupant and returns whoever was seated before", () => {
      const game = makeGame();
      const original = makeOccupant("p1");
      game.join(WHITE, original);

      const reconnected = makeOccupant("p1");
      const previous = game.reseat(WHITE, reconnected);

      expect(game.getOccupant(WHITE)).toBe(reconnected);
      expect(previous).toBe(original);
    });

    it("returns null when seating into a previously empty slot", () => {
      const game = makeGame();
      const occupant = makeOccupant("p1");

      const previous = game.reseat(WHITE, occupant);

      expect(game.getOccupant(WHITE)).toBe(occupant);
      expect(previous).toBeNull();
    });

    it("does not change the game's lifecycle status", () => {
      const game = makeGame();
      const { white } = seatBothPlayers(game);
      expect(game.status).toBe(ACTIVE);

      game.reseat(WHITE, makeOccupant(white.playerId));

      expect(game.status).toBe(ACTIVE);
    });
  });

  describe("broadcast", () => {
    it("notifies every seated occupant with the given event", () => {
      const game = makeGame();
      const { white, black } = seatBothPlayers(game);
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      game.broadcast(event);

      expect(white.notify).toHaveBeenCalledWith(event);
      expect(black.notify).toHaveBeenCalledWith(event);
    });

    it("also emits the event once to the Hub", () => {
      const publisher = makePublisher();
      const game = makeGame(publisher);
      seatBothPlayers(game);
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      game.broadcast(event);

      expect(publisher.emit).toHaveBeenCalledTimes(1);
      expect(publisher.emit).toHaveBeenCalledWith(event);
    });

    it("notifies no one when the game is empty", () => {
      const game = makeGame();
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      expect(() => game.broadcast(event)).not.toThrow();
    });

    it("only notifies whoever is currently seated after a reseat", () => {
      const game = makeGame();
      const { white } = seatBothPlayers(game);
      const reconnected = makeOccupant(white.playerId);
      game.reseat(WHITE, reconnected);
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      game.broadcast(event);

      expect(white.notify).not.toHaveBeenCalled();
      expect(reconnected.notify).toHaveBeenCalledWith(event);
    });
  });

  describe("isEmpty", () => {
    it("returns true when no slots are filled", () => {
      const game = makeGame();
      expect(game.isEmpty).toBe(true);
    });

    it("returns false when at least one slot is filled", () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1"));
      expect(game.isEmpty).toBe(false);
    });
  });

  describe("isWaiting", () => {
    it("returns true when status is WAITING", () => {
      const game = makeGame();
      expect(game.isWaiting).toBe(true);
    });

    it("returns false when status is ACTIVE", () => {
      const game = makeGame();
      seatBothPlayers(game);
      expect(game.isWaiting).toBe(false);
    });

    it("returns false when status is FINISHED", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.expire();
      expect(game.isWaiting).toBe(false);
    });
  });

  describe("isActive", () => {
    it("returns true when status is ACTIVE", () => {
      const game = makeGame();
      seatBothPlayers(game);
      expect(game.isActive).toBe(true);
    });

    it("returns false when status is WAITING", () => {
      const game = makeGame();
      expect(game.isActive).toBe(false);
    });

    it("returns false when status is FINISHED", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.expire();
      expect(game.isActive).toBe(false);
    });
  });

  describe("leave", () => {
    it("removes the occupant from the slot", () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1"));
      game.join(BLACK, makeOccupant("p2"));

      game.leave(WHITE);

      expect(game.getOccupant(WHITE)).toBeNull();
      expect(game.isFull).toBe(false);
    });

    it("broadcasts ROOM_LEFT to the publisher", () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      game.join(WHITE, makeOccupant("p1"));

      game.leave(WHITE);

      expect(publisher.emit).toHaveBeenCalledWith(expect.objectContaining({ type: ROOM_LEFT, color: WHITE }));
    });

    it("does not throw when leaving an already-empty slot", () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1"));
      game.leave(WHITE);
      game.leave(WHITE); // already empty — should be safe
      expect(game.isEmpty).toBe(true);
    });

    it("allows the last occupant to leave without crashing (EC35)", () => {
      const publisher = makePublisher();
      const timer = makeMockTimer();
      const game = makeGame(publisher, timer);
      seatBothPlayers(game); // game becomes ACTIVE, timer started
      game.leave(WHITE);
      game.leave(BLACK); // last occupant leaves

      expect(game.isEmpty).toBe(true);
      expect(game.isActive).toBe(true); // leave doesn't change status
      // Game should still be accessible for queries
      expect(game.nextColor()).toBe(WHITE);
    });
  });

  describe("notify", () => {
    it("delivers only to the given color's occupant", () => {
      const game = makeGame();
      const { white, black } = seatBothPlayers(game);
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      game.notify(WHITE, event);

      expect(white.notify).toHaveBeenCalledWith(event);
      expect(black.notify).not.toHaveBeenCalled();
    });

    it("still emits the event to the Hub", () => {
      const publisher = makePublisher();
      const game = makeGame(publisher);
      seatBothPlayers(game);
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      game.notify(WHITE, event);

      expect(publisher.emit).toHaveBeenCalledWith(event);
    });

    it("does not throw when the color's slot is empty", () => {
      const game = makeGame();
      const event = { type: MOVE_MADE, roomId: "game-1" } as unknown as Notification;

      expect(() => game.notify(WHITE, event)).not.toThrow();
    });
  });

  describe("move", () => {
    it("rejects a move before the game is ACTIVE", async () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1")); // only one seat filled

      const result = await game.move(WHITE, { from: E2, to: E4 });

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });

    it("rejects a move from the color that isn't on turn", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = await game.move(BLACK, { from: E7, to: E5 });

      expect(result).toEqual({ ok: false, error: NOT_YOUR_TURN });
    });

    it("rejects moving from an empty square", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = await game.move(WHITE, { from: E3, to: E4 });

      expect(result).toEqual({ ok: false, error: SQUARE_EMPTY });
    });

    it("rejects an illegal move from an occupied square", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      // Pawns can't jump three squares.
      const result = await game.move(WHITE, { from: E2, to: E5 });

      expect(result).toEqual({ ok: false, error: ILLEGAL_MOVE });
    });

    it("applies a legal move without emitting on its own", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher);
      seatBothPlayers(game);

      const result = await game.move(WHITE, { from: E2, to: E4 });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.value.from).toBe(E2);
      expect(result.value.to).toBe(E4);

      // Delivery/Hub visibility is the caller's job via broadcast()/notify(),
      // not move() itself — see GameService.move().
      expect(publisher.emit).not.toHaveBeenCalled();
    });

    it("hands the turn to the other color after a move", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      await game.move(WHITE, { from: E2, to: E4 });
      const result = await game.move(BLACK, { from: E7, to: E5 });

      expect(result.ok).toBe(true);
    });

    it("finishes the game on checkmate and reports the winner", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = await playFoolsMate(game);

      expect(result.ok).toBe(true);
      expect(game.isFinished).toBe(true);
      expect(game.status).toBe(FINISHED);
      expect(game.endReason).toBe(RULES);
    });

    it("rejects further moves once the game is finished", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);

      const result = await game.move(WHITE, { from: E2, to: E4 });

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });
  });

  describe("selectPosition", () => {
    it("rejects selecting before the game is ACTIVE", () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1")); // only one seat filled

      const result = game.selectPosition(WHITE, E2);

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });

    it("rejects selecting when it isn't that color's turn", () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = game.selectPosition(BLACK, E7);

      expect(result).toEqual({ ok: false, error: NOT_YOUR_TURN });
    });

    it("rejects selecting an empty square", () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = game.selectPosition(WHITE, E3);

      expect(result).toEqual({ ok: false, error: SQUARE_EMPTY });
    });

    it("rejects selecting the opponent's piece", () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = game.selectPosition(WHITE, E7);

      expect(result).toEqual({ ok: false, error: NOT_YOUR_PIECE });
    });

    it("returns the legal destination squares for your own piece", () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = game.selectPosition(WHITE, E2);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.value.sort()).toEqual([E3, E4].sort());
    });

    it("returns an empty array, not an error, for a piece with no legal moves", () => {
      const game = makeGame();
      seatBothPlayers(game);

      // Rook on a1 is boxed in by its own pawn/knight at the start.
      const result = game.selectPosition(WHITE, A1);

      expect(result).toEqual({ ok: true, value: [] });
    });

    it("reflects the position after moves have been played", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });

      const result = game.selectPosition(BLACK, D7);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.value.sort()).toEqual([D5, D6].sort());
    });
  });

  describe("resign", () => {
    it("rejects resigning before the game is ACTIVE", async () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1")); // only one seat filled

      const result = await game.resign(WHITE);

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });

    it("ends the game and declares the other color the winner", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = await game.resign(WHITE);

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.value.winner).toBe(BLACK);
      expect(result.value.hasWinner).toBe(true);
      expect(result.value.reason).toBe(RESIGNATION);

      expect(game.status).toBe(FINISHED);
      expect(game.endReason).toBe(RESIGNATION);
      expect(game.isFinished).toBe(true);
    });

    it("rejects resigning a game that's already finished", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);

      const result = await game.resign(WHITE);

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });
  });

  describe("undo", () => {
    it("rejects undo while the game hasn't started", async () => {
      const game = makeGame();

      const result = await game.undo();

      expect(result).toEqual({ ok: false, error: NO_HISTORY });
    });

    it("rejects undo when active but no move has been played yet", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      const result = await game.undo();

      expect(result).toEqual({ ok: false, error: NO_HISTORY });
    });

    it("undoes the last move and returns it", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });

      const result = await game.undo();

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.value.from).toBe(E2);
      expect(result.value.to).toBe(E4);

      // The move is gone, so it's White's turn again.
      const replay = await game.move(WHITE, { from: E2, to: E4 });
      expect(replay.ok).toBe(true);
    });

    it("reopens a finished game after undoing the mating move", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);
      expect(game.isFinished).toBe(true);

      const result = await game.undo();

      expect(result.ok).toBe(true);
      expect(game.status).toBe(ACTIVE);
      expect(game.isFinished).toBe(false);
    });

    it("rejects undo after resignation instead of reopening and erasing it", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 }); // a real move exists in history
      await game.resign(BLACK);
      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(RESIGNATION);

      const result = await game.undo();

      expect(result).toEqual({ ok: false, error: NOT_ALLOWED });
      // status/endReason must be untouched — no silent reopen
      expect(game.status).toBe(FINISHED);
      expect(game.endReason).toBe(RESIGNATION);
    });

    it("rejects undo after a clock timeout instead of reopening it", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.expire();
      expect(game.endReason).toBe(TIMEOUT);

      const result = await game.undo();

      expect(result).toEqual({ ok: false, error: NOT_ALLOWED });
      expect(game.status).toBe(FINISHED);
    });

    it("rejects undo after abandonment instead of reopening it", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.abandon(BLACK);
      expect(game.endReason).toBe(ABANDONED);

      const result = await game.undo();

      expect(result).toEqual({ ok: false, error: NOT_ALLOWED });
      expect(game.status).toBe(FINISHED);
    });
  });

  describe("canUndo", () => {
    it("is false before the game has started (WAITING)", () => {
      const game = makeGame();
      expect(game.canUndo).toBe(false);
    });

    it("is false when active but no move has been played yet", () => {
      const game = makeGame();
      seatBothPlayers(game);
      expect(game.canUndo).toBe(false);
    });

    it("is true once a move has been played", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      expect(game.canUndo).toBe(true);
    });

    it("is true after a checkmate (rules-based ending)", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);
      expect(game.canUndo).toBe(true);
    });

    it("is false after resignation, even with move history", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.resign(BLACK);
      expect(game.canUndo).toBe(false);
    });

    it("is false after a clock timeout, even with move history", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.expire();
      expect(game.canUndo).toBe(false);
    });

    it("is false after abandonment, even with move history", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.abandon(BLACK);
      expect(game.canUndo).toBe(false);
    });
  });

  describe("moveSeq", () => {
    it("starts at 0", () => {
      const game = makeGame();
      expect(game.moveSeq).toBe(0);
    });

    it("is 0 before any moves even when active", () => {
      const game = makeGame();
      seatBothPlayers(game);
      expect(game.moveSeq).toBe(0);
    });

    it("increments to 1 after the first real move", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      expect(game.moveSeq).toBe(1);
    });

    it("increments to 2 after two real moves", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.move(BLACK, { from: E7, to: E5 });
      expect(game.moveSeq).toBe(2);
    });

    it("does not increment on a rejected move (wrong turn)", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(BLACK, { from: E7, to: E5 }); // rejected — wrong turn
      expect(game.moveSeq).toBe(0);
    });

    it("does not increment on an illegal move", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E5 }); // illegal — pawn can't jump 3
      expect(game.moveSeq).toBe(0);
    });

    it("does NOT decrement after undo", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      expect(game.moveSeq).toBe(1);
      await game.undo();
      expect(game.moveSeq).toBe(1); // unchanged
    });

    it("increments further after undo → new move (ratchet advances)", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      expect(game.moveSeq).toBe(1);
      await game.undo();
      expect(game.moveSeq).toBe(1);
      await game.move(WHITE, { from: G1, to: F3 });
      expect(game.moveSeq).toBe(2); // 2, not 1 again
    });

    it("is included in snapshot at its current value", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      const snap = game.snapshot();
      expect(snap.moveSeq).toBe(1);
    });
  });

  describe("snapshot", () => {
    it("reflects the starting position when no moves have been made", () => {
      const game = makeGame();
      seatBothPlayers(game);

      const snapshot = game.snapshot();

      expect(snapshot.isCheck).toBe(false);
      expect(snapshot.turn).toBe(WHITE);
      expect(snapshot.history).toEqual([]);
      expect(snapshot.capturedByWhite).toEqual([]);
      expect(snapshot.capturedByBlack).toEqual([]);
      expect(snapshot.fen).toContain(" w ");
    });

    it("records SAN history as moves are played", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      await game.move(WHITE, { from: E2, to: E4 });
      await game.move(BLACK, { from: E7, to: E5 });

      const snapshot = game.snapshot();

      expect(snapshot.history).toEqual(["e4", "e5"]);
      expect(snapshot.turn).toBe(WHITE);
    });

    it("tracks captured pieces by the color that captured them", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      // 1. e4 d5 2. exd5 — White captures Black's pawn on d5.
      await game.move(WHITE, { from: E2, to: E4 });
      await game.move(BLACK, { from: D7, to: D5 });
      await game.move(WHITE, { from: E4, to: D5 });

      const snapshot = game.snapshot();

      expect(snapshot.capturedByWhite.length).toBe(1);
      expect(snapshot.capturedByBlack.length).toBe(0);
    });

    it("reports the checkmate outcome after the game ends", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);

      const snapshot = game.snapshot();

      expect(snapshot).toEqual(
        expect.objectContaining({
          resultStatus: CHECKMATE,
          hasWinner: true,
          winner: BLACK,
          endReason: RULES,
        }),
      );
      expect(snapshot.history).toEqual(["f3", "e5", "g4", "Qh4#"]);
    });
  });

  describe("timer — lifecycle", () => {
    it("starts timer when game becomes ACTIVE (second player joins)", () => {
      const timer = makeMockTimer();
      const game = makeGame(undefined, timer);

      game.join(WHITE, makeOccupant("p1"));
      expect(timer.start).not.toHaveBeenCalled();

      game.join(BLACK, makeOccupant("p2"));
      expect(timer.start).toHaveBeenCalledTimes(1);
      expect(timer.start).toHaveBeenCalledWith(game.clock.initialMs, game.clock.initialMs, WHITE);
    });

    it("stops current player and starts opponent on legal move", async () => {
      const timer = makeMockTimer();
      const game = makeGame(undefined, timer);
      seatBothPlayers(game);
      (timer.start as ReturnType<typeof mock>).mockClear();

      await game.move(WHITE, { from: E2, to: E4 });

      expect(timer.stop).toHaveBeenCalledWith(WHITE);
      expect(timer.startNext).toHaveBeenCalledWith(BLACK);
    });

    it("does not stop timer on rejected move (wrong turn)", async () => {
      const timer = makeMockTimer();
      const game = makeGame(undefined, timer);
      seatBothPlayers(game);
      (timer.start as ReturnType<typeof mock>).mockClear();

      await game.move(BLACK, { from: E7, to: E5 });

      expect(timer.stop).not.toHaveBeenCalled();
      expect(timer.startNext).not.toHaveBeenCalled();
    });

    it("does not start opponent timer on game-ending move", async () => {
      const timer = makeMockTimer();
      const game = makeGame(undefined, timer);
      seatBothPlayers(game);
      (timer.start as ReturnType<typeof mock>).mockClear();
      (timer.stop as ReturnType<typeof mock>).mockClear();
      const startNextMock = timer.startNext as ReturnType<typeof mock>;
      startNextMock.mockClear();

      await playFoolsMate(game);

      // Last move (Qh4#) should stop black's clock but NOT start white's
      expect(timer.stop).toHaveBeenCalledWith(BLACK);
      // startNext was called for the 3 non-mating moves, but NOT for the last
      expect(startNextMock.mock.calls.length).toBe(3);
    });

    it("disposes timer on resign", async () => {
      const timer = makeMockTimer();
      const game = makeGame(undefined, timer);
      seatBothPlayers(game);
      (timer.start as ReturnType<typeof mock>).mockClear();

      await game.resign(WHITE);

      expect(timer.dispose).toHaveBeenCalledTimes(1);
    });

    it("swaps timer active back to the player whose move was undone", async () => {
      const timer = makeStatefulTimer();
      const game = makeGame(undefined, timer);
      seatBothPlayers(game);

      // After seating, White is to move and timer starts on White
      // Manually start the timer to simulate the activation
      timer._active = WHITE;

      // White makes a move → timer should now be on Black
      await game.move(WHITE, { from: E2, to: E4 });
      expect(timer._active).toBe(BLACK);

      // Undo → timer should flip back to White
      await game.undo();
      expect(timer._active).toBe(WHITE);
    });

    it("includes clock state in snapshot", () => {
      const timer = makeMockTimer();
      timer.state.whiteMs = 250_000;
      timer.state.blackMs = 180_000;
      timer.state.active = WHITE;
      const game = makeGame(undefined, timer);

      const snap = game.snapshot();

      expect(snap.clock).toEqual({ whiteMs: 250_000, blackMs: 180_000, active: WHITE });
    });
  });

  describe("timer — expiry → forfeit", () => {
    it("forfeits the expired side on CLOCK_EXPIRED", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      // Simulate CLOCK_EXPIRED
      await game.expire();

      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(TIMEOUT);
    });

    it("does nothing on CLOCK_EXPIRED if already finished", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      await game.expire();
      await game.expire(); // second expiry — no-op

      expect(game.endReason).toBe(TIMEOUT);
    });

    it("reports the non-expired side as winner", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      await game.expire();

      const snap = game.snapshot();
      expect(snap.winner).toBe(BLACK);
      expect(snap.hasWinner).toBe(true);
      expect(snap.endReason).toBe(TIMEOUT);
    });

    it("rejects further moves after expiry-forfeit", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      await game.expire();

      const result = await game.move(BLACK, { from: E7, to: E5 });
      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });
  });

  describe("abandon", () => {
    it("ends the game as ABANDONED with the opponent as winner", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      await game.abandon(WHITE);

      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(ABANDONED);
      const snap = game.snapshot();
      expect(snap.winner).toBe(BLACK);
      expect(snap.hasWinner).toBe(true);
      expect(snap.endReason).toBe(ABANDONED);
    });

    it("broadcasts GAME_ENDED with abandonment result", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      await game.abandon(WHITE);

      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "game:ended",
          result: expect.objectContaining({ reason: ABANDONED, winner: BLACK }),
        }),
      );
    });

    it("is a no-op if already finished", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);

      await game.abandon(WHITE); // first — ends the game
      publisher.emit = mock(() => {}); // reset broadcast spy
      await game.abandon(BLACK); // second — no-op

      expect(game.endReason).toBe(ABANDONED);
      expect(publisher.emit).not.toHaveBeenCalled();
    });

    it("disposes the timer", async () => {
      const timer = makeMockTimer();
      const game = makeGame(undefined, timer);
      seatBothPlayers(game);

      await game.abandon(WHITE);

      expect(timer.dispose).toHaveBeenCalled();
    });

    it("rejects further moves after abandonment", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      await game.abandon(WHITE);

      const result = await game.move(BLACK, { from: E7, to: E5 });
      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });

    it("handles abandon when both slots have occupants", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      await game.abandon(BLACK);

      expect(game.snapshot().winner).toBe(WHITE);
    });

    it("handles abandon when the opponent slot is empty", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      game.leave(BLACK); // opponent leaves — game is still ACTIVE but only WHITE remains

      await game.abandon(WHITE);

      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(ABANDONED);
      const snap = game.snapshot();
      expect(snap.hasWinner).toBe(false);
      expect(snap.winner).toBe(WHITE); // dummy default, not meaningful when hasWinner=false
    });

    it("is a no-op if game is not ACTIVE (WAITING)", async () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1"));

      await game.abandon(WHITE);

      expect(game.isFinished).toBe(false);
      expect(game.status).toBe(WAITING);
    });
  });

  describe("expire — edge cases", () => {
    it("broadcasts even when no occupants are seated", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      game.join(WHITE, makeOccupant("p1"));
      game.join(BLACK, makeOccupant("p2"));
      game.leave(WHITE);
      game.leave(BLACK); // both occupants gone, game still ACTIVE

      await game.expire();

      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(TIMEOUT);
      expect(publisher.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "game:ended",
        }),
      );
    });

    it("is a no-op if already finished with no occupants", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher, makeMockTimer());
      seatBothPlayers(game);
      await game.expire();

      game.leave(WHITE);
      game.leave(BLACK);
      publisher.emit = mock(() => {}); // reset after leave broadcasts
      await game.expire(); // second expiry — should not broadcast

      expect(publisher.emit).not.toHaveBeenCalled();
    });
  });

  describe("draw detection", () => {
    it("detects stalemate", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      (game as unknown as { chess: Chess }).chess = new Chess({ fen: "k7/8/1K6/8/8/8/8/1R6 w - - 0 1" });

      const result = await game.move(WHITE, { from: B6, to: A6 });

      expect(result.ok).toBe(true);
      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(RULES);
      expect(game.snapshot().resultStatus).toBe(DRAW);
      expect(game.snapshot().drawReason).toBe(STALEMATE);
    });

    it("detects threefold repetition", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      await game.move(WHITE, { from: G1, to: F3 });
      await game.move(BLACK, { from: G8, to: F6 });
      await game.move(WHITE, { from: F3, to: G1 });
      await game.move(BLACK, { from: F6, to: G8 });
      await game.move(WHITE, { from: G1, to: F3 });
      await game.move(BLACK, { from: G8, to: F6 });
      await game.move(WHITE, { from: F3, to: G1 });
      const result = await game.move(BLACK, { from: F6, to: G8 });

      expect(result.ok).toBe(true);
      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(RULES);
      expect(game.snapshot().resultStatus).toBe(DRAW);
      expect(game.snapshot().drawReason).toBe(THREEFOLD_REPETITION);
    });

    it("detects fifty-move rule", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      (game as unknown as { chess: Chess }).chess = new Chess({
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 99 1",
      });

      const result = await game.move(WHITE, { from: G1, to: F3 });

      expect(result.ok).toBe(true);
      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(RULES);
      expect(game.snapshot().resultStatus).toBe(DRAW);
      expect(game.snapshot().drawReason).toBe(FIFTY_MOVE_RULE);
    });

    it("detects insufficient material", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      (game as unknown as { chess: Chess }).chess = new Chess({ fen: "8/4N3/8/3b4/8/2K5/8/k7 w - - 0 1" });

      const result = await game.move(WHITE, { from: E7, to: D5 });

      expect(result.ok).toBe(true);
      expect(game.isFinished).toBe(true);
      expect(game.endReason).toBe(RULES);
      expect(game.snapshot().resultStatus).toBe(DRAW);
      expect(game.snapshot().drawReason).toBe(INSUFFICIENT_MATERIAL);
    });

    it("returns GAME_OVER from defensive isOver check when position is already a draw", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      (game as unknown as { chess: Chess }).chess = new Chess({ fen: "8/8/8/8/8/8/4K3/4k3 w - - 0 1" });

      const result = await game.move(WHITE, { from: E2, to: F3 });

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });
  });

  describe("turn getter", () => {
    it("returns WHITE at the start", () => {
      const game = makeGame();
      seatBothPlayers(game);
      expect(game.turn).toBe(WHITE);
    });

    it("returns BLACK after White moves", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      expect(game.turn).toBe(BLACK);
    });

    it("returns WHITE again after undo", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.undo();
      expect(game.turn).toBe(WHITE);
    });
  });

  describe("isFinished getter", () => {
    it("returns false before any result", () => {
      const game = makeGame();
      expect(game.isFinished).toBe(false);
    });

    it("returns true after checkmate", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);
      expect(game.isFinished).toBe(true);
    });

    it("returns true after resign", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.resign(WHITE);
      expect(game.isFinished).toBe(true);
    });

    it("returns false after undo reopens a checkmate game", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);
      await game.undo();
      expect(game.isFinished).toBe(false);
    });
  });

  describe("expire when WAITING", () => {
    it("is a no-op when the game has not started", async () => {
      const game = makeGame();
      game.join(WHITE, makeOccupant("p1")); // only one player, still WAITING

      await game.expire();

      expect(game.status).toBe(WAITING);
      expect(game.isFinished).toBe(false);
      expect(game.endReason).toBeNull();
    });
  });

  describe("selectPosition after game ends", () => {
    it("returns GAME_OVER when selecting on a finished game", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);

      const result = game.selectPosition(WHITE, E2);

      expect(result).toEqual({ ok: false, error: GAME_OVER });
    });
  });

  describe("canUndo after undo empties history", () => {
    it("returns false when the only move has been undone", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await game.move(WHITE, { from: E2, to: E4 });
      await game.undo();
      expect(game.canUndo).toBe(false);
    });
  });
});
