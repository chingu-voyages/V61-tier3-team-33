import { ROOM_FULL } from "../domain/result";
import {
  BLACK,
  IN_PROGRESS,
  WHITE,
  type JoinInput,
  type MoveInput,
  type PieceColor,
  type WebSocket,
} from "../domain/types";
import type { Game } from "../game/game";
import type { GameStore } from "../game/games";
import { Human } from "../occupant/human";
import {
  GAME_FINISHED,
  GAME_FULL,
  NOT_AUTHENTICATED,
  NOT_IN_GAME,
  ROOM_NOT_FOUND,
} from "../protocol/errors";
import {
  GAME_ENDED,
  GAME_STARTED,
  MOVE_MADE,
  MOVE_REJECTED,
  ROOM_JOINED,
  UNDO_APPLIED,
  UNDO_DECLINED,
  UNDO_REQUESTED,
  type Notification,
} from "../protocol/events";
import type { Protocol } from "../protocol/protocol";
import { Reply } from "../protocol/replies";
import type { SessionStore } from "../session/sessions";

/** How long an undo request stays valid; only seeds `expiresAt`, not enforced yet. */
const UNDO_REQUEST_TTL_MS = 30 * 1000;

/** Player-facing actions a client can trigger over a socket. */
export interface GameFacade {
  /** Joins or rejoins a game. */
  join(ws: WebSocket, input: JoinInput): Promise<void>;
  /** Attempts a move for the caller's color. */
  move(ws: WebSocket, input: MoveInput): Promise<void>;
  /** Asks the opponent to undo the last move. */
  requestUndo(ws: WebSocket): Promise<void>;
  /** Accepts the opponent's pending undo request. */
  acceptUndo(ws: WebSocket): Promise<void>;
  /** Declines the opponent's pending undo request. */
  declineUndo(ws: WebSocket): Promise<void>;
  /** Ends the game as a resignation by the caller. */
  resign(ws: WebSocket): Promise<void>;
  /** Resends the caller's current game state. */
  sync(ws: WebSocket): Promise<void>;
}

/** Orchestrates client actions against sessions and games; wire-level only, no game rules. */
export class GameService implements GameFacade {
  /**
   * roomId -> color who requested an undo. Lives here, not on `Game`,
   * since it's a service-level handshake, not part of game rules.
   */
  private pendingUndos = new Map<string, PieceColor>();

  constructor(
    private sessions: SessionStore,
    private games: GameStore,
    private protocol: Protocol,
  ) {}

  /** @inheritdoc */
  async join(ws: WebSocket, input: JoinInput): Promise<void> {
    const session = this.sessions.bySocket(ws);
    if (!session) {
      Reply.send(ws, Reply.error(NOT_AUTHENTICATED, "Session not found."));
      return;
    }

    // Rejoin on reconnect.
    if (session.roomId && session.color !== null) {
      const existing = this.games.get(session.roomId);
      if (existing && !existing.isFinished) {
        const previous = existing.getOccupant(session.color);
        const occupant =
          previous instanceof Human
            ? previous.replaceSocket(ws)
            : new Human(session.playerId, ws, this.protocol);
        existing.reseat(session.color, occupant);

        // TODO: notify the opponent that this player reconnected. There's
        // no player-facing Notification for this yet — CONNECTION_RESUMED
        // exists in events.ts but is typed as a Signal (Hub-only, rejected
        // by Occupant.notify's type signature on purpose). Needs: (1) a
        // real Notification variant, and (2) Connections.identify to
        // actually distinguish a resumed session from a freshly opened
        // one — right now it always emits CONNECTION_OPENED regardless of
        // which branch resumeOrOpen took.

        existing.notify(session.color, {
          type: ROOM_JOINED,
          roomId: existing.id,
          color: session.color,
          state: existing.snapshot(),
        });

        return;
      }
    }

    // Create or join a game.
    let game: Game;
    if (input.roomId) {
      const found = this.games.get(input.roomId);
      if (!found) {
        Reply.send(ws, Reply.error(ROOM_NOT_FOUND, "Room not found."));
        return;
      }
      game = found;
    } else {
      game =
        this.games.findWaiting(input.mode) ??
        this.games.create(undefined, input.mode);
    }

    const color = input.color ?? game.nextColor();
    if (color === null) {
      Reply.send(ws, Reply.error(GAME_FULL, "Game is full."));
      return;
    }

    const occupant = new Human(session.playerId, ws, this.protocol);
    const result = game.join(color, occupant);
    if (!result.ok) {
      if (result.error === ROOM_FULL) {
        Reply.send(ws, Reply.error(GAME_FULL, "That color is already taken."));
      } else {
        Reply.send(
          ws,
          Reply.error(GAME_FINISHED, "This game has already finished."),
        );
      }
      return;
    }

    this.sessions.bind(ws, { roomId: game.id, color, mode: input.mode });
    this.games.commit(game.id, game);

    const state = game.snapshot();

    game.notify(color, {
      type: ROOM_JOINED,
      roomId: game.id,
      color,
      state: state,
    });

    if (game.isActive) {
      game.broadcast({
        type: GAME_STARTED,
        roomId: game.id,
        fen: state.fen,
        clock: null,
      });
    }
  }

  /** @inheritdoc */
  async move(ws: WebSocket, input: MoveInput): Promise<void> {
    const seated = this.seated(ws);
    if (!seated) return;
    const { game, color } = seated;

    const result = await game.move(color, input);

    if (!result.ok) {
      game.notify(color, {
        type: MOVE_REJECTED,
        roomId: game.id,
        by: color,
        reason: result.error,
        from: input.from,
        to: input.to,
      });
      return;
    }

    const snapshot = game.snapshot();
    const isGameOver = snapshot.result.status !== IN_PROGRESS;

    game.broadcast({
      type: MOVE_MADE,
      roomId: game.id,
      by: color,
      move: result.value,
      isCheck: snapshot.isCheck,
      isGameOver,
      result: isGameOver ? snapshot.result : null,
      clock: null,
    });
  }

  /** @inheritdoc */
  async requestUndo(ws: WebSocket): Promise<void> {
    const seated = this.seated(ws);
    if (!seated) return;
    const { game, color } = seated;

    if (!game.isActive) {
      Reply.send(
        ws,
        Reply.error(GAME_FINISHED, "This game has already finished."),
      );
      return;
    }

    // No-op if a request is already pending (either side) — the opponent
    // should accept/decline the existing one instead.
    if (this.pendingUndos.has(game.id)) return;

    this.pendingUndos.set(game.id, color);

    const opponentColor = color === WHITE ? BLACK : WHITE;
    game.notify(opponentColor, {
      type: UNDO_REQUESTED,
      roomId: game.id,
      by: color,
      expiresAt: Date.now() + UNDO_REQUEST_TTL_MS,
    });
  }

  /** @inheritdoc */
  async acceptUndo(ws: WebSocket): Promise<void> {
    const seated = this.seated(ws);
    if (!seated) return;
    const { game, color } = seated;

    const requestedBy = this.pendingUndos.get(game.id);

    // No pending request, or you can't accept your own — silently ignore
    // rather than invent a dedicated error code for a stale client action.
    if (requestedBy === undefined || requestedBy === color) return;

    this.pendingUndos.delete(game.id);

    const result = await game.undo();
    if (!result.ok) return;

    game.broadcast({
      type: UNDO_APPLIED,
      roomId: game.id,
      state: game.snapshot(),
      clock: null,
    });
  }

  /** @inheritdoc */
  async declineUndo(ws: WebSocket): Promise<void> {
    const seated = this.seated(ws);
    if (!seated) return;
    const { game, color } = seated;

    const requestedBy = this.pendingUndos.get(game.id);
    if (requestedBy === undefined || requestedBy === color) return;

    this.pendingUndos.delete(game.id);

    game.broadcast({
      type: UNDO_DECLINED,
      roomId: game.id,
      by: color,
      reason: "declined",
    });
  }

  /** @inheritdoc */
  async resign(ws: WebSocket): Promise<void> {
    const seated = this.seated(ws);
    if (!seated) return;
    const { game, color } = seated;

    const result = await game.resign(color);
    if (!result.ok) {
      Reply.send(
        ws,
        Reply.error(GAME_FINISHED, "This game has already finished."),
      );
      return;
    }

    this.pendingUndos.delete(game.id);

    game.broadcast({
      type: GAME_ENDED,
      roomId: game.id,
      result: result.value,
      winner: result.value.winner,
    });
  }

  /** @inheritdoc */
  async sync(ws: WebSocket): Promise<void> {
    const seated = this.seated(ws);
    if (!seated) return;
    const { game, color } = seated;

    game.notify(color, {
      type: ROOM_JOINED,
      roomId: game.id,
      color,
      state: game.snapshot(),
    });
  }

  /** Resolves the caller's session + game, replying with an error and returning null if either is missing. */
  private seated(ws: WebSocket): { game: Game; color: PieceColor } | null {
    const session = this.sessions.bySocket(ws);
    if (!session) {
      Reply.send(ws, Reply.error(NOT_AUTHENTICATED, "Session not found."));
      return null;
    }
    if (!session.roomId || session.color === null) {
      Reply.send(ws, Reply.error(NOT_IN_GAME, "You are not in a game."));
      return null;
    }

    const game = this.games.get(session.roomId);
    if (!game) {
      Reply.send(ws, Reply.error(ROOM_NOT_FOUND, "Room not found."));
      return null;
    }

    return { game, color: session.color };
  }
}
