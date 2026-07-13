import { describe, expect, it } from "bun:test";

import {
  ACTIVE,
  BLACK,
  CHECKMATE,
  DRAW,
  type GameSnapshot,
  ILLEGAL_MOVE,
  IN_PROGRESS,
  type Move,
  NO_DRAW_REASON,
  NORMAL,
  NOT_YOUR_PIECE,
  PAWN,
  Position,
  RESIGNATION,
  RULES,
  STALEMATE,
  WHITE,
} from "../types";
import { Notifications, Signals } from "./events";
import {
  CLOCK_EXPIRED,
  CLOCK_PAUSED,
  CLOCK_STARTED,
  CONNECTION_CLOSED,
  CONNECTION_OPENED,
  CONNECTION_RESUMED,
  GAME_ENDED,
  GAME_STARTED,
  GRACE_CANCELLED,
  GRACE_EXPIRED,
  GRACE_STARTED,
  MOVE_MADE,
  MOVE_REJECTED,
  POSITION_ACCEPTED,
  POSITION_REJECTED,
  ROOM_JOINED,
  ROOM_LEFT,
  UNDO_APPLIED,
  UNDO_DECLINED,
  UNDO_REQUESTED,
} from "./events";

function snap(overrides?: Partial<GameSnapshot>): GameSnapshot {
  return {
    status: ACTIVE,
    moveSeq: 0,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    turn: WHITE,
    isCheck: false,
    resultStatus: IN_PROGRESS,
    winner: WHITE,
    hasWinner: false,
    drawReason: NO_DRAW_REASON,
    endReason: RULES,
    history: [],
    capturedByWhite: [],
    capturedByBlack: [],
    clock: null,
    ...overrides,
  };
}

const E2 = Position.parse("e2")!;
const E4 = Position.parse("e4")!;
const A2 = Position.parse("a2")!;
const A3 = Position.parse("a3")!;

function aMove(overrides?: Partial<Move>): Move {
  return {
    piece: { type: PAWN, color: WHITE },
    from: E2,
    to: E4,
    type: NORMAL,
    promoteTo: null,
    captured: null,
    ...overrides,
  };
}

describe("Signals", () => {
  it("connectionOpened builds a CONNECTION_OPENED signal with playerId, ws, and null roomId", () => {
    const ws: unknown = "ws-1";
    const signal = Signals.connectionOpened("p1", ws);

    expect(signal).toEqual({
      type: CONNECTION_OPENED,
      playerId: "p1",
      ws,
      roomId: null,
    });
  });

  it("connectionClosed builds a CONNECTION_CLOSED signal with playerId, ws, and null roomId", () => {
    const ws: unknown = "ws-2";
    const signal = Signals.connectionClosed("p2", ws);

    expect(signal).toEqual({
      type: CONNECTION_CLOSED,
      playerId: "p2",
      ws,
      roomId: null,
    });
  });

  it("connectionResumed builds a CONNECTION_RESUMED signal with playerId, ws, and null roomId", () => {
    const ws: unknown = "ws-3";
    const signal = Signals.connectionResumed("p3", ws);

    expect(signal).toEqual({
      type: CONNECTION_RESUMED,
      playerId: "p3",
      ws,
      roomId: null,
    });
  });

  it("all signals have roomId: null (never sent to clients)", () => {
    const ws: unknown = "ws";
    const opened = Signals.connectionOpened("p", ws);
    const closed = Signals.connectionClosed("p", ws);
    const resumed = Signals.connectionResumed("p", ws);

    expect(opened.roomId).toBeNull();
    expect(closed.roomId).toBeNull();
    expect(resumed.roomId).toBeNull();
  });
});

describe("Notifications", () => {
  describe("room:joined", () => {
    it("builds a ROOM_JOINED notification carrying roomId, color, and state snapshot", () => {
      const state = snap();
      const event = Notifications.roomJoined("room-1", WHITE, state);

      expect(event).toEqual({
        type: ROOM_JOINED,
        roomId: "room-1",
        color: WHITE,
        state,
      });
    });

    it("carries whatever GameSnapshot is passed through, unmodified", () => {
      const state = snap({ fen: "custom fen", turn: BLACK });
      const event = Notifications.roomJoined("r2", BLACK, state);

      const ev = event as { state: GameSnapshot };
      expect(ev.state.fen).toBe("custom fen");
      expect(ev.state.turn).toBe(BLACK);
    });
  });

  describe("game:started", () => {
    it("builds a GAME_STARTED notification with fen, turn, and clock state", () => {
      const clock = { whiteMs: 60000, blackMs: 60000, active: WHITE };
      const event = Notifications.gameStarted("room-1", "fen-str", WHITE, clock);

      expect(event).toEqual({
        type: GAME_STARTED,
        roomId: "room-1",
        fen: "fen-str",
        turn: WHITE,
        clock,
      });
    });

    it("passes null clock when no clock strategy is used", () => {
      const event = Notifications.gameStarted("room-1", "fen", WHITE, null);

      expect((event as { clock: null }).clock).toBeNull();
    });
  });

  describe("room:left", () => {
    it("builds a ROOM_LEFT notification with roomId and color", () => {
      const event = Notifications.roomLeft("room-1", WHITE);

      expect(event).toEqual({
        type: ROOM_LEFT,
        roomId: "room-1",
        color: WHITE,
      });
    });
  });

  describe("game:ended", () => {
    it("builds a GAME_ENDED notification with result and winner", () => {
      const result = {
        status: CHECKMATE,
        winner: BLACK,
        hasWinner: true,
        drawReason: NO_DRAW_REASON,
        reason: RESIGNATION,
      };
      const event = Notifications.gameEnded("room-1", result, BLACK);

      expect(event).toEqual({
        type: GAME_ENDED,
        roomId: "room-1",
        result,
        winner: BLACK,
      });
    });

    it("carries null winner for draw outcomes", () => {
      const result = {
        status: DRAW,
        winner: WHITE,
        hasWinner: false,
        drawReason: STALEMATE,
        reason: RULES,
      };
      const event = Notifications.gameEnded("room-1", result, null);

      expect((event as { winner: null }).winner).toBeNull();
    });
  });

  describe("move:made", () => {
    it("derives isGameOver from snapshot's resultStatus", () => {
      const move = aMove();
      const state = snap({ resultStatus: CHECKMATE, hasWinner: true, winner: WHITE, endReason: RULES });
      const event = Notifications.moveMade("room-1", WHITE, move, state);

      expect(event.type).toBe(MOVE_MADE);
      const ev = event as {
        isGameOver: boolean;
        result: { status: unknown; hasWinner: boolean; reason: unknown } | null;
      };
      expect(ev.isGameOver).toBe(true);
      expect(ev.result).not.toBeNull();
      expect(ev.result!.status).toBe(CHECKMATE);
      expect(ev.result!.hasWinner).toBe(true);
      expect(ev.result!.reason).toBe(RULES);
    });

    it("sets isGameOver=false and result=null when game is in progress", () => {
      const move = aMove();
      const state = snap({ resultStatus: IN_PROGRESS });
      const event = Notifications.moveMade("room-1", WHITE, move, state);

      const ev2 = event as { isGameOver: boolean; result: null };
      expect(ev2.isGameOver).toBe(false);
      expect(ev2.result).toBeNull();
    });

    it("exposes check, turn, and clock from the snapshot", () => {
      const move = aMove();
      const clock = { whiteMs: 50000, blackMs: 60000, active: BLACK };
      const state = snap({ isCheck: true, turn: BLACK, clock });
      const event = Notifications.moveMade("room-1", WHITE, move, state);

      const ev3 = event as { isCheck: boolean; turn: typeof WHITE | typeof BLACK; clock: unknown };
      expect(ev3.isCheck).toBe(true);
      expect(ev3.turn).toBe(BLACK);
      expect(ev3.clock).toEqual(clock);
    });

    it("coalesces null clock to null in the event", () => {
      const move = aMove();
      const state = snap({ clock: null });
      const event = Notifications.moveMade("room-1", WHITE, move, state);

      expect((event as { clock: null }).clock).toBeNull();
    });
  });

  describe("move:rejected", () => {
    it("builds a MOVE_REJECTED notification with from/to and error reason", () => {
      const event = Notifications.moveRejected("room-1", WHITE, ILLEGAL_MOVE, A2 as Position, A3 as Position);

      expect(event).toEqual({
        type: MOVE_REJECTED,
        roomId: "room-1",
        by: WHITE,
        reason: ILLEGAL_MOVE,
        from: A2,
        to: A3,
      });
    });
  });

  describe("undo:requested", () => {
    it("builds an UNDO_REQUESTED notification with expiresAt timestamp", () => {
      const event = Notifications.undoRequested("room-1", WHITE, 1000);

      expect(event).toEqual({
        type: UNDO_REQUESTED,
        roomId: "room-1",
        by: WHITE,
        expiresAt: 1000,
      });
    });
  });

  describe("undo:applied", () => {
    it("builds an UNDO_APPLIED notification carrying the updated snapshot", () => {
      const state = snap({ fen: "after undo" });
      const event = Notifications.undoApplied("room-1", state);

      expect(event).toEqual({
        type: UNDO_APPLIED,
        roomId: "room-1",
        state,
        clock: null,
      });
    });

    it("extracts clock from the snapshot", () => {
      const clock = { whiteMs: 55000, blackMs: 60000, active: WHITE };
      const state = snap({ clock });
      const event = Notifications.undoApplied("room-1", state);

      expect((event as { clock: unknown }).clock).toEqual(clock);
    });
  });

  describe("undo:declined", () => {
    it("builds an UNDO_DECLINED notification with the declining player's color", () => {
      const event = Notifications.undoDeclined("room-1", BLACK);

      expect(event).toEqual({
        type: UNDO_DECLINED,
        roomId: "room-1",
        by: BLACK,
      });
    });
  });

  describe("position:accept", () => {
    it("builds a POSITION_ACCEPTED notification with position and legal moves", () => {
      const event = Notifications.positionAccepted("room-1", E2 as Position, [E4 as Position]);

      expect(event).toEqual({
        type: POSITION_ACCEPTED,
        roomId: "room-1",
        position: E2,
        moves: [E4],
      });
    });
  });

  describe("position:reject", () => {
    it("builds a POSITION_REJECTED notification with rejection reason", () => {
      const event = Notifications.positionRejected("room-1", E2 as Position, NOT_YOUR_PIECE);

      expect(event).toEqual({
        type: POSITION_REJECTED,
        roomId: "room-1",
        position: E2,
        reason: NOT_YOUR_PIECE,
      });
    });
  });

  describe("clock events", () => {
    it("clockStarted builds CLOCK_STARTED with remaining ms", () => {
      const event = Notifications.clockStarted("room-1", WHITE, 60000);

      expect(event).toEqual({
        type: CLOCK_STARTED,
        roomId: "room-1",
        color: WHITE,
        remainingMs: 60000,
      });
    });

    it("clockPaused builds CLOCK_PAUSED with remaining ms", () => {
      const event = Notifications.clockPaused("room-1", BLACK, 55000);

      expect(event).toEqual({
        type: CLOCK_PAUSED,
        roomId: "room-1",
        color: BLACK,
        remainingMs: 55000,
      });
    });

    it("clockExpired builds CLOCK_EXPIRED with the expired color", () => {
      const event = Notifications.clockExpired("room-1", WHITE);

      expect(event).toEqual({
        type: CLOCK_EXPIRED,
        roomId: "room-1",
        color: WHITE,
      });
    });
  });

  describe("grace events", () => {
    it("graceStarted builds GRACE_STARTED with deadlineMs", () => {
      const event = Notifications.graceStarted("room-1", WHITE, 5000);

      expect(event).toEqual({
        type: GRACE_STARTED,
        roomId: "room-1",
        color: WHITE,
        deadlineMs: 5000,
      });
    });

    it("graceCancelled builds GRACE_CANCELLED with the reconnected player's color", () => {
      const event = Notifications.graceCancelled("room-1", WHITE);

      expect(event).toEqual({
        type: GRACE_CANCELLED,
        roomId: "room-1",
        color: WHITE,
      });
    });

    it("graceExpired builds GRACE_EXPIRED with the expired player's color", () => {
      const event = Notifications.graceExpired("room-1", WHITE);

      expect(event).toEqual({
        type: GRACE_EXPIRED,
        roomId: "room-1",
        color: WHITE,
      });
    });
  });
});
