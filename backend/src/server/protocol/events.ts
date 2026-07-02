import type {
  ClockState,
  GameOutcome,
  GameSnapshot,
  Move,
  PieceColor,
  Position,
} from "../domain/types";
import type { MoveError } from "../domain/result";

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

// Clock — emitted by ClockTimer (owned by Moves)
export const CLOCK_STARTED = "clock:started" as const;
export const CLOCK_PAUSED = "clock:paused" as const;
export const CLOCK_EXPIRED = "clock:expired" as const;
export const CLOCK_TICK = "clock:tick" as const;

// Grace — emitted by GraceTimer (owned by Reactor)
export const GRACE_STARTED = "grace:started" as const;
export const GRACE_CANCELLED = "grace:cancelled" as const;
export const GRACE_EXPIRED = "grace:expired" as const;

// Signal — server machinery only. Reaches Hub subscribers;
// never sent to a client. Occupant.notify's type signature rejects these.
export type Signal =
  | { type: typeof CONNECTION_OPENED; playerId: string; ws: WebSocket }
  | { type: typeof CONNECTION_CLOSED; playerId: string; ws: WebSocket }
  | { type: typeof CONNECTION_RESUMED; playerId: string; ws: WebSocket }
  | { type: typeof CLOCK_TICK; roomId: string; clock: ClockState };

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
      clock: ClockState | null;
    }
  | {
      type: typeof ROOM_LEFT;
      roomId: string;
      color: PieceColor;
      reason: string;
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
      result: GameOutcome | null;
      clock: ClockState | null;
    }
  | {
      type: typeof MOVE_REJECTED;
      roomId: string;
      by: PieceColor;
      reason: MoveError;
      from: Position;
      to: Position;
    }
  | {
      type: typeof UNDO_REQUESTED;
      roomId: string;
      by: PieceColor;
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
      reason: string;
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
