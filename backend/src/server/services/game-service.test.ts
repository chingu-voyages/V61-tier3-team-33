import { describe, expect, it, mock } from "bun:test";
import { GameService } from "./game-service";
import { Sessions } from "../session/sessions";
import { Games } from "../game/games";
import { Hub } from "../bus/bus";
import {
  WHITE,
  BLACK,
  HUMAN_VS_HUMAN,
  WS_OPEN,
  type JoinInput,
  type WebSocket,
} from "../domain/types";
import type { Protocol } from "../protocol/protocol";
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
} from "../protocol/events";
import { SESSION_ERROR } from "../protocol/errors";
import { E2, E3, E4, E5, E7 } from "../../chess";

describe("GameService", () => {
  /** A Protocol whose encode just JSON-stringifies the notification. */
  function makeProtocol(): Protocol {
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
    const protocol = makeProtocol();
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
  });
});
