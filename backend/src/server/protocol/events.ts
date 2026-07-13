import type { GameError } from "../types";
import {
  type ClockState,
  GameOutcome,
  type GameSnapshot,
  IN_PROGRESS,
  type Move,
  type PieceColor,
  type Position,
} from "../types";

type WebSocket = unknown;

// Transport — emitted by Connections. Server-side lifecycle, not player-facing.
export const CONNECTION_OPENED = "connection:opened" as const;
export const CONNECTION_CLOSED = "connection:closed" as const;
export const CONNECTION_RESUMED = "connection:resumed" as const;

// Room lifecycle — emitted by Game
export const ROOM_JOINED = "room:joined" as const;
export const GAME_STARTED = "game:started" as const;
export const ROOM_LEFT = "room:left" as const;
export const GAME_ENDED = "game:ended" as const;

// Moves — emitted by Game
export const MOVE_MADE = "move:made" as const;
export const MOVE_REJECTED = "move:rejected" as const;

// Undo flow — emitted by Game
export const UNDO_REQUESTED = "undo:requested" as const;
export const UNDO_APPLIED = "undo:applied" as const;
export const UNDO_DECLINED = "undo:declined" as const;
export const UNDO_CANCELLED = "undo:cancelled" as const;
export const UNDO_EXPIRED = "undo:expired" as const;
export const UNDO_INVALIDATED = "undo:invalidated" as const;

// Position selection (click-a-piece step before move:make) — emitted by Game
export const POSITION_ACCEPTED = "position:accept" as const;
export const POSITION_REJECTED = "position:reject" as const;

// Clock — emitted by ClockTimer (owned by Moves)
export const CLOCK_STARTED = "clock:started" as const;
export const CLOCK_PAUSED = "clock:paused" as const;
export const CLOCK_EXPIRED = "clock:expired" as const;

// Grace — emitted by Grace (owned by Connections)
export const GRACE_STARTED = "grace:started" as const;
export const GRACE_CANCELLED = "grace:cancelled" as const;
export const GRACE_EXPIRED = "grace:expired" as const;

// Signal — server machinery only. Reaches Hub subscribers;
// never sent to a client. Occupant.notify's type signature rejects these.
export type Signal =
  | {
      type: typeof CONNECTION_OPENED;
      playerId: string;
      ws: WebSocket;
      roomId: null;
    }
  | {
      type: typeof CONNECTION_CLOSED;
      playerId: string;
      ws: WebSocket;
      roomId: null;
    }
  | {
      type: typeof CONNECTION_RESUMED;
      playerId: string;
      ws: WebSocket;
      roomId: null;
    };

// Notification — a player needs to know. Reaches Hub subscribers AND
// goes out to clients via Occupant.notify → Protocol.encode → ws.send.
export type Notification =
  | {
      type: typeof ROOM_JOINED;
      roomId: string;
      color: PieceColor;
      state: GameSnapshot;
    }
  | {
      type: typeof GAME_STARTED;
      roomId: string;
      fen: string;
      turn: PieceColor;
      clock: ClockState | null;
    }
  | {
      type: typeof ROOM_LEFT;
      roomId: string;
      color: PieceColor;
    }
  | {
      type: typeof GAME_ENDED;
      roomId: string;
      result: GameOutcome;
      winner: PieceColor | null;
    }
  | {
      type: typeof MOVE_MADE;
      roomId: string;
      by: PieceColor;
      move: Move;
      isCheck: boolean;
      isGameOver: boolean;
      turn: PieceColor;
      result: GameOutcome | null;
      clock: ClockState | null;
    }
  | {
      type: typeof MOVE_REJECTED;
      roomId: string;
      by: PieceColor;
      reason: GameError;
      from: Position;
      to: Position;
    }
  | {
      type: typeof UNDO_REQUESTED;
      roomId: string;
      by: PieceColor;
      /** When the opponent's accept window closes (existing consent timeout). */
      expiresAt: number;
    }
  | {
      type: typeof UNDO_APPLIED;
      roomId: string;
      state: GameSnapshot;
      clock: ClockState | null;
    }
  | {
      type: typeof UNDO_DECLINED;
      roomId: string;
      by: PieceColor;
    }
  | {
      type: typeof UNDO_CANCELLED;
      roomId: string;
    }
  | {
      type: typeof UNDO_EXPIRED;
      roomId: string;
    }
  | {
      type: typeof UNDO_INVALIDATED;
      roomId: string;
    }
  | {
      type: typeof POSITION_ACCEPTED;
      roomId: string;
      position: Position;
      moves: Position[];
    }
  | {
      type: typeof POSITION_REJECTED;
      roomId: string;
      position: Position;
      reason: GameError;
    }
  | {
      type: typeof CLOCK_STARTED;
      roomId: string;
      color: PieceColor;
      remainingMs: number;
    }
  | {
      type: typeof CLOCK_PAUSED;
      roomId: string;
      color: PieceColor;
      remainingMs: number;
    }
  | {
      type: typeof CLOCK_EXPIRED;
      roomId: string;
      color: PieceColor;
    }
  | {
      type: typeof GRACE_STARTED;
      roomId: string;
      color: PieceColor;
      deadlineMs: number;
    }
  | {
      type: typeof GRACE_CANCELLED;
      roomId: string;
      color: PieceColor;
    }
  | {
      type: typeof GRACE_EXPIRED;
      roomId: string;
      color: PieceColor;
    };

// Everything that can flow through Hub. Occupant.notify only accepts
// Notification — the type system rejects Signals at that boundary.
export type Event = Notification | Signal;

/** Extract the specific Event variant for a given type string. */
export type Events<T extends string> = Extract<Event, { type: T }>;

/**
 * The single place that builds every Signal. Same rationale as
 * Notifications below: one spot owns each signal's exact shape instead of
 * every emitter (Connections, ClockTimer, …) hand-rolling the literal.
 */
export const Signals = {
  connectionOpened(playerId: string, ws: WebSocket): Signal {
    return { type: CONNECTION_OPENED, playerId, ws, roomId: null };
  },

  connectionClosed(playerId: string, ws: WebSocket): Signal {
    return { type: CONNECTION_CLOSED, playerId, ws, roomId: null };
  },

  /**
   * Not emitted yet — Connections.identify always emits connectionOpened
   * regardless of whether resumeOrOpen resumed an existing session or
   * opened a fresh one. Wire this up once that distinction is surfaced.
   */
  connectionResumed(playerId: string, ws: WebSocket): Signal {
    return { type: CONNECTION_RESUMED, playerId, ws, roomId: null };
  },
};

/**
 * The single place that builds every player-facing Notification. Callers
 * (GameService, Game) pass in the raw ingredients; this object owns each
 * event's exact shape. Add or rename a field here once, instead of at
 * every call site that happens to construct that event.
 *
 * Lives alongside the Notification union on purpose — one file to check
 * for "what events exist, what do they carry, and how are they built."
 */
export const Notifications = {
  roomJoined(roomId: string, color: PieceColor, state: GameSnapshot): Notification {
    return { type: ROOM_JOINED, roomId, color, state };
  },

  /** Broadcast once, the moment a room's second seat fills. */
  gameStarted(roomId: string, fen: string, turn: PieceColor, clock: ClockState | null): Notification {
    return { type: GAME_STARTED, roomId, fen, turn, clock };
  },

  roomLeft(roomId: string, color: PieceColor): Notification {
    return { type: ROOM_LEFT, roomId, color };
  },

  gameEnded(roomId: string, result: GameOutcome, winner: PieceColor | null): Notification {
    return { type: GAME_ENDED, roomId, result, winner };
  },

  /**
   * Derives isGameOver/result from the post-move snapshot itself, so
   * callers just hand over the snapshot instead of recomputing it.
   */
  moveMade(roomId: string, by: PieceColor, move: Move, snapshot: GameSnapshot): Notification {
    const isGameOver = snapshot.resultStatus !== IN_PROGRESS;

    return {
      type: MOVE_MADE,
      roomId,
      by,
      move,
      isCheck: snapshot.isCheck,
      isGameOver,
      turn: snapshot.turn,
      result: isGameOver ? GameOutcome.fromSnapshot(snapshot) : null,
      clock: snapshot.clock ?? null,
    };
  },

  moveRejected(roomId: string, by: PieceColor, reason: GameError, from: Position, to: Position): Notification {
    return { type: MOVE_REJECTED, roomId, by, reason, from, to };
  },

  undoRequested(roomId: string, by: PieceColor, expiresAt: number): Notification {
    return { type: UNDO_REQUESTED, roomId, by, expiresAt };
  },

  undoApplied(roomId: string, state: GameSnapshot): Notification {
    return { type: UNDO_APPLIED, roomId, state, clock: state.clock ?? null };
  },

  undoDeclined(roomId: string, by: PieceColor): Notification {
    return { type: UNDO_DECLINED, roomId, by };
  },

  undoCancelled(roomId: string): Notification {
    return { type: UNDO_CANCELLED, roomId };
  },

  undoExpired(roomId: string): Notification {
    return { type: UNDO_EXPIRED, roomId };
  },

  undoInvalidated(roomId: string): Notification {
    return { type: UNDO_INVALIDATED, roomId };
  },

  positionAccepted(roomId: string, position: Position, moves: Position[]): Notification {
    return { type: POSITION_ACCEPTED, roomId, position, moves };
  },

  positionRejected(roomId: string, position: Position, reason: GameError): Notification {
    return { type: POSITION_REJECTED, roomId, position, reason };
  },

  clockStarted(roomId: string, color: PieceColor, remainingMs: number): Notification {
    return { type: CLOCK_STARTED, roomId, color, remainingMs };
  },

  clockPaused(roomId: string, color: PieceColor, remainingMs: number): Notification {
    return { type: CLOCK_PAUSED, roomId, color, remainingMs };
  },

  clockExpired(roomId: string, color: PieceColor): Notification {
    return { type: CLOCK_EXPIRED, roomId, color };
  },

  /** Emitted when a disconnected player's grace period begins. */
  graceStarted(roomId: string, color: PieceColor, deadlineMs: number): Notification {
    return { type: GRACE_STARTED, roomId, color, deadlineMs };
  },

  /** Emitted when the disconnected player reconnects before grace expired. */
  graceCancelled(roomId: string, color: PieceColor): Notification {
    return { type: GRACE_CANCELLED, roomId, color };
  },

  /** Emitted when the grace period expires without reconnection. */
  graceExpired(roomId: string, color: PieceColor): Notification {
    return { type: GRACE_EXPIRED, roomId, color };
  },
};
