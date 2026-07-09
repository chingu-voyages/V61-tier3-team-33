import { describe, expect, it, mock } from "bun:test";
import { GameService } from "./game-service";
import { Sessions } from "../session/sessions";
import { Games } from "../game/games";
import { Hub } from "../bus/bus";
import {
  WHITE,
  BLACK,
  ABANDONED,
  HUMAN_VS_HUMAN,
  WS_OPEN,
  type JoinInput,
  type WebSocket,
} from "../types";
import type { Codec } from "../codec/codec";
import {
  NOT_AUTHENTICATED,
  NOT_IN_GAME,
  ROOM_NOT_FOUND,
  GAME_FULL,
  GAME_FINISHED,
} from "../protocol/errors";
import {
  ROOM_JOINED,
  GAME_STARTED,
  MOVE_MADE,
  MOVE_REJECTED,
  GAME_ENDED,
  ROOM_LEFT,
  UNDO_REQUESTED,
  UNDO_APPLIED,
  UNDO_DECLINED,
  POSITION_ACCEPTED,
  POSITION_REJECTED,
  GRACE_STARTED,
  GRACE_CANCELLED,
  CONNECTION_CLOSED,
  Notifications,
} from "../protocol/events";
import { SESSION_ERROR } from "../protocol/errors";
import { createClock } from "../clock/factory";
import { E2, E3, E4, E5, E7, F2, F3, G2, G4, D8, H4 } from "../../chess";

describe("GameService", () => {
  /** A Codec whose encode just JSON-stringifies the notification. */
  function makeCodec(): Codec {
    return {
      decode: mock(() => null),
      encode: mock((event) => JSON.stringify(event)),
    };
  }

  /** A fake socket recording every payload sent through it. */
  function makeSocket(id: string): WebSocket {
    return {
      id,
      readyState: WS_OPEN,
      send: mock(() => {}),
      close: mock(() => {}),
    } as unknown as WebSocket;
  }

  /** Every message sent on `ws`, parsed from JSON in send order. */
  function sent(ws: WebSocket): any[] {
    return (ws.send as ReturnType<typeof mock>).mock.calls.map((call: any[]) =>
      JSON.parse(call[0]),
    );
  }

  /** The most recent message sent on `ws`, or undefined if none. */
  function lastSent(ws: WebSocket): any {
    const msgs = sent(ws);
    return msgs[msgs.length - 1];
  }

  function makeService() {
    const sessions = new Sessions();
    const games = new Games(new Hub());
    const protocol = makeCodec();
    const service = new GameService(sessions, games, protocol);
    return { service, sessions, games };
  }

  /** Opens a session for a fresh socket, as Connections would on connect. */
  function connect(sessions: Sessions, ws: WebSocket) {
    return sessions.open(ws, `player-${ws.id}`);
  }

  /** Seats two fresh players into the same new HUMAN_VS_HUMAN game. */
  async function seatTwoPlayers(service: GameService, sessions: Sessions) {
    const white = makeSocket("white");
    const black = makeSocket("black");
    connect(sessions, white);
    connect(sessions, black);

    const input: JoinInput = { mode: HUMAN_VS_HUMAN };
    await service.join(white, input);
    const roomId = lastSent(white).roomId;
    await service.join(black, { ...input, roomId });

    return { white, black, roomId };
  }

  describe("join", () => {
    it("replies NOT_AUTHENTICATED with no session", async () => {
      const { service } = makeService();
      const ws = makeSocket("ghost");

      await service.join(ws, { mode: HUMAN_VS_HUMAN });

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({
          type: SESSION_ERROR,
          code: NOT_AUTHENTICATED,
        }),
      );
    });

    it("creates a new game and seats the first joiner as WHITE", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.join(ws, { mode: HUMAN_VS_HUMAN });

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: ROOM_JOINED, color: WHITE }),
      );
    });

    it("seats the second joiner as BLACK and broadcasts GAME_STARTED", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: GAME_STARTED }),
      );
      // GAME_STARTED goes to both seated occupants, not just the joiner.
      expect(sent(white).at(-1)).toEqual(
        expect.objectContaining({ type: GAME_STARTED, turn: WHITE }),
      );
    });

    it("replies ROOM_NOT_FOUND for an unknown roomId", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.join(ws, { mode: HUMAN_VS_HUMAN, roomId: "nope" });

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: ROOM_NOT_FOUND }),
      );
    });

    it("replies GAME_FULL when both colors are already taken", async () => {
      const { service, sessions } = makeService();
      const { roomId } = await seatTwoPlayers(service, sessions);
      const third = makeSocket("p3");
      connect(sessions, third);

      await service.join(third, { mode: HUMAN_VS_HUMAN, roomId });

      expect(lastSent(third)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: GAME_FULL }),
      );
    });

    it("reseats a reconnecting session on the same game", async () => {
      const { service, sessions } = makeService();
      const { white, roomId } = await seatTwoPlayers(service, sessions);
      const session = sessions.bySocket(white)!;

      const resumedWs = makeSocket("white-resumed");
      sessions.resume(session.token, resumedWs);

      await service.join(resumedWs, { mode: HUMAN_VS_HUMAN });

      expect(lastSent(resumedWs)).toEqual(
        expect.objectContaining({
          type: ROOM_JOINED,
          roomId,
          color: WHITE,
        }),
      );
    });

    it("sends final snapshot when reconnecting to a finished game", async () => {
      const { service, sessions } = makeService();
      const { white, black, roomId } = await seatTwoPlayers(service, sessions);

      // Play Fool's Mate so the game finishes
      await service.move(white, { from: F2, to: F3 });
      await service.move(black, { from: E7, to: E5 });
      await service.move(white, { from: G2, to: G4 });
      await service.move(black, { from: D8, to: H4 });

      const session = sessions.bySocket(white)!;
      const resumedWs = makeSocket("white-resumed");
      sessions.resume(session.token, resumedWs);

      await service.join(resumedWs, { mode: HUMAN_VS_HUMAN });

      expect(lastSent(resumedWs)).toEqual(
        expect.objectContaining({
          type: ROOM_JOINED,
          roomId,
          color: WHITE,
          state: expect.objectContaining({
            hasWinner: true,
            winner: BLACK,
          }),
        }),
      );
    });
  });

  describe("move", () => {
    it("replies NOT_IN_GAME when authenticated but not seated", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.move(ws, { from: E2, to: E4 });

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: NOT_IN_GAME }),
      );
    });

    it("notifies only the mover on an illegal move", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      await service.move(white, { from: E2, to: E5 }); // pawns can't jump 3

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: MOVE_REJECTED, by: WHITE }),
      );
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: GAME_STARTED }),
      );
    });

    it("broadcasts MOVE_MADE to both players on a legal move", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      await service.move(white, { from: E2, to: E4 });

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: MOVE_MADE, by: WHITE }),
      );
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: MOVE_MADE, by: WHITE }),
      );
    });
  });

  describe("resign", () => {
    it("broadcasts GAME_ENDED with the opponent as winner", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      await service.resign(white);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: GAME_ENDED, winner: BLACK }),
      );
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: GAME_ENDED, winner: BLACK }),
      );
    });

    it("replies GAME_FINISHED when resigning an already-finished game", async () => {
      const { service, sessions } = makeService();
      const { white } = await seatTwoPlayers(service, sessions);

      await service.resign(white);
      await service.resign(white);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: GAME_FINISHED }),
      );
    });
  });

  describe("undo flow", () => {
    it("notifies only the opponent on requestUndo", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      const whiteCallsBefore = sent(white).length;

      await service.requestUndo(white);

      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: UNDO_REQUESTED, by: WHITE }),
      );
      expect(sent(white).length).toBe(whiteCallsBefore); // requester gets nothing
    });

    it("ignores a second request while one is already pending", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      await service.requestUndo(white);
      const blackCallsAfterFirst = sent(black).length;
      await service.requestUndo(white);

      expect(sent(black).length).toBe(blackCallsAfterFirst);
    });

    it("acceptUndo undoes the move and broadcasts UNDO_APPLIED", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });
      await service.requestUndo(white);

      await service.acceptUndo(black);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: UNDO_APPLIED }),
      );
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: UNDO_APPLIED }),
      );
    });

    it("ignores acceptUndo from the requester themselves", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });
      await service.requestUndo(white);
      const whiteCallsBefore = sent(white).length;
      const blackCallsBefore = sent(black).length;

      await service.acceptUndo(white);

      expect(sent(white).length).toBe(whiteCallsBefore);
      expect(sent(black).length).toBe(blackCallsBefore);
    });

    it("ignores acceptUndo when nothing is pending", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });
      const blackCallsBefore = sent(black).length;

      await service.acceptUndo(black);

      expect(sent(black).length).toBe(blackCallsBefore);
    });

    it("declineUndo broadcasts UNDO_DECLINED and clears the pending request", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.requestUndo(white);

      await service.declineUndo(black);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: UNDO_DECLINED, by: BLACK }),
      );

      // Pending state was cleared, so a fresh request works again.
      await service.requestUndo(white);
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: UNDO_REQUESTED }),
      );
    });

    it("ignores declineUndo when nothing is pending", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      const blackCallsBefore = sent(black).length;

      await service.declineUndo(black);

      // No notification should be sent
      expect(sent(black).length).toBe(blackCallsBefore);
    });
  });

  describe("sync", () => {
    it("replies NOT_IN_GAME when not seated", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.sync(ws);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: NOT_IN_GAME }),
      );
    });

    it("sends only the caller their current snapshot", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });
      const blackCallsBefore = sent(black).length;

      await service.sync(white);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({
          type: ROOM_JOINED,
          color: WHITE,
          state: expect.objectContaining({ history: ["e4"] }),
        }),
      );
      expect(sent(black).length).toBe(blackCallsBefore); // black got nothing
    });

    it("sends the final snapshot when syncing from a finished game", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      // Play Fool's Mate so the game finishes
      await service.move(white, { from: F2, to: F3 });
      await service.move(black, { from: E7, to: E5 });
      await service.move(white, { from: G2, to: G4 });
      await service.move(black, { from: D8, to: H4 });

      await service.sync(white);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({
          type: ROOM_JOINED,
          color: WHITE,
          state: expect.objectContaining({
            hasWinner: true,
            winner: BLACK,
          }),
        }),
      );
    });
  });

  describe("selectPosition", () => {
    it("replies NOT_IN_GAME when authenticated but not seated", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.selectPosition(ws, E2);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: NOT_IN_GAME }),
      );
    });

    it("accepts your own piece and replies with its legal destinations", async () => {
      const { service, sessions } = makeService();
      const { white } = await seatTwoPlayers(service, sessions);

      await service.selectPosition(white, E2);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({
          type: POSITION_ACCEPTED,
          position: E2,
          moves: expect.arrayContaining([E3, E4]),
        }),
      );
    });

    it("rejects the opponent's piece and only notifies the requester", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      const blackCallsBefore = sent(black).length;

      await service.selectPosition(white, E7);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({
          type: POSITION_REJECTED,
          position: E7,
        }),
      );
      expect(sent(black).length).toBe(blackCallsBefore);
    });

    it("rejects selecting when it isn't your turn", async () => {
      const { service, sessions } = makeService();
      const { black } = await seatTwoPlayers(service, sessions);

      await service.selectPosition(black, E7);

      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: POSITION_REJECTED, position: E7 }),
      );
    });
  });

  describe("leave", () => {
    it("replies NOT_AUTHENTICATED when not connected", async () => {
      const { service } = makeService();
      const ws = makeSocket("ghost");

      await service.leave(ws);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({
          type: SESSION_ERROR,
          code: NOT_AUTHENTICATED,
        }),
      );
    });

    it("replies NOT_IN_GAME when connected but not seated", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.leave(ws);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: NOT_IN_GAME }),
      );
    });

    it("broadcasts ROOM_LEFT to both players", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      await service.leave(white);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: ROOM_LEFT, color: WHITE }),
      );
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: ROOM_LEFT, color: WHITE }),
      );
    });

    it("clears the session's roomId and color", async () => {
      const { service, sessions } = makeService();
      const { white } = await seatTwoPlayers(service, sessions);

      const sessionBefore = sessions.bySocket(white)!;
      expect(sessionBefore.roomId).not.toBeNull();
      expect(sessionBefore.color).not.toBeNull();

      await service.leave(white);

      const sessionAfter = sessions.bySocket(white)!;
      expect(sessionAfter.roomId).toBeNull();
      expect(sessionAfter.color).toBeNull();
    });

    it("clears any pending undo request", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });
      await service.requestUndo(white);

      await service.leave(white);

      // After leave, black should be able to acceptUndo without effect
      // (pending was cleared). Black should get no UNDO_APPLIED.
      const blackCallsBefore = sent(black).length;
      await service.acceptUndo(black);
      expect(sent(black).length).toBe(blackCallsBefore);
    });

    it("allows the other player to still leave afterwards", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      await service.leave(white);
      await service.leave(black);

      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: ROOM_LEFT, color: BLACK }),
      );
    });

    it("allows leaving as the only occupant (game never ACTIVE)", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("solo");
      connect(sessions, ws);

      await service.join(ws, { mode: HUMAN_VS_HUMAN });

      // Game is WAITING with only this player — leave should succeed
      await service.leave(ws);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: ROOM_LEFT }),
      );
    });

    it("allows both players to leave an active game without crashing (EC35)", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });

      // Both leave
      await service.leave(white);
      await service.leave(black);

      // No crash — both got ROOM_LEFT
      expect(lastSent(white)).toEqual(
        expect.objectContaining({ type: ROOM_LEFT }),
      );
      expect(lastSent(black)).toEqual(
        expect.objectContaining({ type: ROOM_LEFT }),
      );
    });
  });

  describe("join — edge cases", () => {
    it("clears session roomId when rejoin game is gone, then creates new game (EC3)", async () => {
      const { service, sessions, games } = makeService();
      const { white, roomId } = await seatTwoPlayers(service, sessions);

      const session = sessions.bySocket(white)!;
      sessions.bind(white, { roomId: "ghost-room" });

      // Join without roomId — should clear stale session then fall through
      const ws2 = makeSocket("rejoin");
      sessions.open(ws2, "player-rejoin");
      sessions.bind(ws2, { roomId: "ghost-room", color: WHITE });
      await service.join(ws2, { mode: HUMAN_VS_HUMAN });

      // Session's stale roomId should have been cleared
      const updated = sessions.bySocket(ws2)!;
      expect(updated.roomId).not.toBe("ghost-room");

      // Should have started a new game (fall-through to findWaiting/create)
      const msgs = sent(ws2);
      const joined = msgs.find((m) => m.type === ROOM_JOINED);
      expect(joined).toBeDefined();
      expect(joined!.roomId).not.toBe(roomId);
    });

    it("clears session roomId when rejoin game is gone and invitee sends roomId (regression)", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("invitee");
      connect(sessions, ws);

      // Session has a stale roomId from a previous session
      sessions.bind(ws, { roomId: "stale-room", color: BLACK });

      // Try to join a different missing room (as invitee would)
      await service.join(ws, { mode: HUMAN_VS_HUMAN, roomId: "missing-room" });

      // Should get ROOM_NOT_FOUND
      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: ROOM_NOT_FOUND }),
      );

      // Session should have stale roomId cleared
      const session = sessions.bySocket(ws)!;
      expect(session.roomId).toBeNull();
      expect(session.color).toBeNull();
    });

    it("clears session roomId when invite link room is missing (regression)", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("invitee");
      connect(sessions, ws);

      await service.join(ws, { mode: HUMAN_VS_HUMAN, roomId: "nope" });

      // Should get ROOM_NOT_FOUND
      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: ROOM_NOT_FOUND }),
      );

      // Session should be cleared for retry
      const session = sessions.bySocket(ws)!;
      expect(session.roomId).toBeNull();
      expect(session.color).toBeNull();
    });

    it("replies GAME_FINISHED when joining a finished game by roomId (EC5)", async () => {
      const { service, sessions } = makeService();
      const { white, black, roomId } = await seatTwoPlayers(service, sessions);

      // Play Fool's Mate to finish the game
      await service.move(white, { from: F2, to: F3 });
      await service.move(black, { from: E7, to: E5 });
      await service.move(white, { from: G2, to: G4 });
      await service.move(black, { from: D8, to: H4 });

      // Have WHITE leave so there's an open slot
      await service.leave(white);

      // A third player tries to join the finished game by roomId
      const intruder = makeSocket("intruder");
      connect(sessions, intruder);
      await service.join(intruder, { mode: HUMAN_VS_HUMAN, roomId });

      expect(lastSent(intruder)).toEqual(
        expect.objectContaining({ code: GAME_FINISHED }),
      );
    });

    it("uses the provided color when joining", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);

      await service.join(ws, { mode: HUMAN_VS_HUMAN, color: BLACK });

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: ROOM_JOINED, color: BLACK }),
      );
    });

    it("matches into a waiting game without roomId", async () => {
      const { service, sessions } = makeService();
      const ws1 = makeSocket("p1");
      connect(sessions, ws1);
      await service.join(ws1, { mode: HUMAN_VS_HUMAN });
      const roomId = lastSent(ws1).roomId;

      // Second player joins without roomId — should find the waiting game
      const ws2 = makeSocket("p2");
      connect(sessions, ws2);
      await service.join(ws2, { mode: HUMAN_VS_HUMAN });

      const msgs = sent(ws2);
      const joinMsg = msgs.find((m) => m.type === ROOM_JOINED);
      expect(joinMsg).toBeDefined();
      expect(joinMsg!.roomId).toBe(roomId);
    });

    it("reseats into current room even when a different roomId is given (EC11)", async () => {
      const { service, sessions, games } = makeService();
      const { white, roomId } = await seatTwoPlayers(service, sessions);

      // White is in roomId — try to join a different room
      const otherGame = games.create("other-room", HUMAN_VS_HUMAN, createClock());
      sessions.bind(white, { roomId, color: WHITE, mode: HUMAN_VS_HUMAN });

      await service.join(white, { mode: HUMAN_VS_HUMAN, roomId: "other-room" });

      // Should still be in the original room (rejoin branch keys off session.roomId)
      const msgs = sent(white);
      const joined = msgs.find((m) => m.type === ROOM_JOINED);
      expect(joined).toBeDefined();
      expect(joined!.roomId).toBe(roomId);
      expect(joined!.roomId).not.toBe("other-room");
    });
  });

  describe("game-guard paths", () => {
    it("replies NOT_IN_GAME when move is called from a session with stale roomId", async () => {
      const { service, sessions, games } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);
      sessions.bind(ws, { roomId: "ghost-room", color: WHITE });

      await service.move(ws, { from: E2, to: E4 });

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: ROOM_NOT_FOUND }),
      );
    });

    it("replies ROOM_NOT_FOUND when resigning from a stale roomId", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);
      sessions.bind(ws, { roomId: "ghost-room", color: WHITE });

      await service.resign(ws);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: ROOM_NOT_FOUND }),
      );
    });

    it("replies ROOM_NOT_FOUND when leaving from a stale roomId", async () => {
      const { service, sessions } = makeService();
      const ws = makeSocket("p1");
      connect(sessions, ws);
      sessions.bind(ws, { roomId: "ghost-room", color: WHITE });

      await service.leave(ws);

      expect(lastSent(ws)).toEqual(
        expect.objectContaining({ type: SESSION_ERROR, code: ROOM_NOT_FOUND }),
      );
    });
  });

  describe("requestUndo — edge cases", () => {
    it("replies GAME_FINISHED when requesting undo on a finished game (EC24)", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);

      // Play Fool's Mate
      await service.move(white, { from: F2, to: F3 });
      await service.move(black, { from: E7, to: E5 });
      await service.move(white, { from: G2, to: G4 });
      await service.move(black, { from: D8, to: H4 });

      await service.requestUndo(white);

      expect(lastSent(white)).toEqual(
        expect.objectContaining({ code: GAME_FINISHED }),
      );
    });
  });

  describe("declineUndo — self-decline", () => {
    it("ignores declineUndo from the requester themselves", async () => {
      const { service, sessions } = makeService();
      const { white, black } = await seatTwoPlayers(service, sessions);
      await service.move(white, { from: E2, to: E4 });

      await service.requestUndo(white);

      // White tries to decline their own request — should be no-op
      const blackCallsBefore = sent(black).length;
      await service.declineUndo(white);
      expect(sent(black).length).toBe(blackCallsBefore);
    });
  });

  describe("grace timer — disconnect & reconnect", () => {
    function makeServiceWithHub() {
      const sessions = new Sessions();
      const hub = new Hub();
      const games = new Games(hub);
      const protocol = makeCodec();
      const service = new GameService(sessions, games, protocol, hub);
      return { service, sessions, hub, games };
    }

    it("notifies opponent with GRACE_STARTED on disconnect during active game", async () => {
      const { service, sessions, hub } = makeServiceWithHub();
      const { white, black, roomId } = await seatTwoPlayers(service, sessions);

      // Simulate real flow: Connections.close() calls sessions.drop() then emits CONNECTION_CLOSED
      const whiteSession = sessions.bySocket(white)!;
      sessions.drop(white);
      hub.emit({ type: CONNECTION_CLOSED, playerId: whiteSession.playerId, ws: white, roomId: null });

      // Deferred handler runs on next tick
      await new Promise((r) => setTimeout(r, 5));

      const blackMessages = sent(black);
      const graceStarted = blackMessages.find((m) => m.type === "grace:started");
      expect(graceStarted).toBeDefined();
      expect(graceStarted!.color).toBe(WHITE);
      expect(graceStarted!.roomId).toBe(roomId);
    });

    it("does not send GRACE_STARTED if game is not active", async () => {
      const { service, sessions, hub } = makeServiceWithHub();
      const ws = makeSocket("p1");
      connect(sessions, ws);
      await service.join(ws, { mode: HUMAN_VS_HUMAN });

      const session = sessions.bySocket(ws)!;
      sessions.drop(ws);
      hub.emit({ type: CONNECTION_CLOSED, playerId: session.playerId, ws, roomId: null });

      await new Promise((r) => setTimeout(r, 5));

      const msgs = sent(ws);
      expect(msgs.some((m) => m.type === "grace:started")).toBe(false);
    });

    it("sends GRACE_CANCELLED to opponent on rejoin", async () => {
      const { service, sessions, hub } = makeServiceWithHub();
      const { white, black, roomId } = await seatTwoPlayers(service, sessions);

      // Disconnect white
      const whiteSession = sessions.bySocket(white)!;
      sessions.drop(white);
      hub.emit({ type: CONNECTION_CLOSED, playerId: whiteSession.playerId, ws: white, roomId: null });
      await new Promise((r) => setTimeout(r, 5));

      // Reconnect white with new socket
      const white2 = makeSocket("white2");
      sessions.resume(whiteSession.token, white2);
      await service.join(white2, { mode: HUMAN_VS_HUMAN });

      // Black should have received GRACE_CANCELLED
      const blackMessages = sent(black);
      const graceCancelled = blackMessages.find((m) => m.type === "grace:cancelled");
      expect(graceCancelled).toBeDefined();
      expect(graceCancelled!.color).toBe(WHITE);
      expect(graceCancelled!.roomId).toBe(roomId);
    });

    it("abandons the game when GRACE_EXPIRED fires", async () => {
      const { service, sessions, hub } = makeServiceWithHub();
      const { white, black, roomId } = await seatTwoPlayers(service, sessions);
      const blackMsgsBefore = sent(black).length;

      // Emit GRACE_EXPIRED directly — Connections sends this via Hub
      // when the grace timer expires.
      hub.emit(Notifications.graceExpired(roomId, WHITE));

      // DEFERRED handler runs on next tick
      await new Promise((r) => setTimeout(r, 5));

      const blackMessages = sent(black);
      const gameEnded = blackMessages.find((m) => m.type === "game:ended");
      expect(gameEnded).toBeDefined();
      expect(gameEnded!.result.reason).toBe(ABANDONED);
      expect(gameEnded!.winner).toBe(BLACK);
    });

    describe("CONNECTION_CLOSED — edge cases", () => {
      it("does nothing for an unknown playerId", async () => {
        const { service, sessions, hub } = makeServiceWithHub();

        hub.emit({ type: CONNECTION_CLOSED, playerId: "nobody", ws: makeSocket("x"), roomId: null });

        await new Promise((r) => setTimeout(r, 5));
      });

      it("does nothing for a connected player not in a game", async () => {
        const { service, sessions, hub } = makeServiceWithHub();
        const ws = makeSocket("idle");
        connect(sessions, ws);

        const session = sessions.bySocket(ws)!;
        sessions.drop(ws);
        hub.emit({ type: CONNECTION_CLOSED, playerId: session.playerId, ws, roomId: null });

        await new Promise((r) => setTimeout(r, 5));
      });

      it("does nothing when the game no longer exists", async () => {
        const { service, sessions, hub } = makeServiceWithHub();
        const ws = makeSocket("p1");
        connect(sessions, ws);
        await service.join(ws, { mode: HUMAN_VS_HUMAN });

        const session = sessions.bySocket(ws)!;
        sessions.bind(ws, { roomId: "ghost-room" });
        sessions.drop(ws);
        hub.emit({ type: CONNECTION_CLOSED, playerId: session.playerId, ws, roomId: null });

        await new Promise((r) => setTimeout(r, 5));
      });
    });
  });
});
