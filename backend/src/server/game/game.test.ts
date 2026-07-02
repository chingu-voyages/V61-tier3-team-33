import { describe, expect, it, mock } from "bun:test";
import { Game } from "./game";
import type { Occupant } from "../occupant/occupant";
import type { Publisher } from "../bus/bus";
import {
  WHITE,
  BLACK,
  WAITING,
  ACTIVE,
  FINISHED,
  RULES,
  HUMAN,
  HUMAN_VS_HUMAN,
  CHECKMATE,
} from "../domain/types";
import {
  NOT_YOUR_TURN,
  ILLEGAL_MOVE,
  GAME_OVER,
  SQUARE_EMPTY,
  NO_HISTORY,
  ROOM_FULL,
  INVALID_MODE,
} from "../domain/result";
import { MOVE_MADE } from "../protocol/events";
import { D5, D7, E2, E3, E4, E5, E7, F2, F3, G2, G4, D8, H4 } from "../../chess";

// --- test helpers -----------------------------------------------------

function makeOccupant(playerId: string): Occupant {
  return { kind: HUMAN, playerId, notify: mock(() => {}) };
}

function makePublisher() {
  return { emit: mock(() => {}) } satisfies Publisher;
}

function makeGame(publisher: Publisher = makePublisher()) {
  return new Game("game-1", HUMAN_VS_HUMAN, publisher);
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

// --- tests --------------------------------------------------------------

describe("Game", () => {
  describe("initial state", () => {
    it("starts WAITING, not full, not finished, with no end reason", () => {
      const game = makeGame();

      expect(game.status).toBe(WAITING);
      expect(game.endReason).toBeNull();
      expect(game.isFull).toBe(false);
      expect(game.isFinished).toBe(false);
    });

    it("carries the id and mode passed to the constructor", () => {
      const game = new Game("room-42", HUMAN_VS_HUMAN, makePublisher());

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

    it("applies a legal move and publishes MOVE_MADE", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher);
      seatBothPlayers(game);

      const result = await game.move(WHITE, { from: E2, to: E4 });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.value.from).toBe(E2);
      expect(result.value.to).toBe(E4);

      expect(publisher.emit).toHaveBeenCalledTimes(1);
      expect(publisher.emit).toHaveBeenCalledWith(
        "game-1",
        expect.objectContaining({
          type: MOVE_MADE,
          roomId: "game-1",
          by: WHITE,
          isGameOver: false,
          result: null,
        }),
      );
    });

    it("hands the turn to the other color after a move", async () => {
      const game = makeGame();
      seatBothPlayers(game);

      await game.move(WHITE, { from: E2, to: E4 });
      const result = await game.move(BLACK, { from: E7, to: E5 });

      expect(result.ok).toBe(true);
    });

    it("finishes the game on checkmate and reports the winner", async () => {
      const publisher = makePublisher();
      const game = makeGame(publisher);
      seatBothPlayers(game);

      const result = await playFoolsMate(game);

      expect(result.ok).toBe(true);
      expect(game.isFinished).toBe(true);
      expect(game.status).toBe(FINISHED);
      expect(game.endReason).toBe(RULES);

      expect(publisher.emit).toHaveBeenLastCalledWith(
        "game-1",
        expect.objectContaining({
          type: MOVE_MADE,
          by: BLACK,
          isGameOver: true,
          result: expect.objectContaining({
            status: CHECKMATE,
            hasWinner: true,
            winner: BLACK,
            reason: RULES,
          }),
        }),
      );
    });

    it("rejects further moves once the game is finished", async () => {
      const game = makeGame();
      seatBothPlayers(game);
      await playFoolsMate(game);

      const result = await game.move(WHITE, { from: E2, to: E4 });

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
  });

  describe("snapshot", () => {
    it("reflects the starting position when no moves have been made", () => {
      const game = makeGame();
      seatBothPlayers(game);

      const snapshot = game.snapshot();

      expect(snapshot.isCheck).toBe(false);
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

      expect(snapshot.result).toEqual(
        expect.objectContaining({
          status: CHECKMATE,
          hasWinner: true,
          winner: BLACK,
          reason: RULES,
        }),
      );
      expect(snapshot.history).toEqual(["f3", "e5", "g4", "Qh4#"]);
    });
  });
});
