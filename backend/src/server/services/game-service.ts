import { ROOM_FULL } from "../domain/result";
import {
  BLACK,
  WHITE,
  type JoinInput,
  type MoveInput,
  type PieceColor,
  type Position,
  type WebSocket,
} from "../domain/types";
import type { Game } from "../game/game";
import type { GameStore } from "../game/game-store";
import { Human } from "../occupant/human";
import {
  GAME_FINISHED,
  GAME_FULL,
  NOT_AUTHENTICATED,
  NOT_IN_GAME,
  ROOM_NOT_FOUND,
} from "../protocol/errors";
import { Notifications } from "../protocol/events";
import type { Protocol } from "../protocol/protocol";
import { Reply } from "../protocol/replies";
import type { SessionStore } from "../session/session-store";
import { logger as rootLogger } from "../../logging/logger";
import type { GameFacade } from "./game-facade";
import type { Session } from "../session/session";

const log = rootLogger.child({ module: "GameService" });

/** How long an undo request stays valid; only seeds `expiresAt`, not enforced yet. */
const UNDO_REQUEST_TTL_MS = 30 * 1000;

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

        existing.notify(
          session.color,
          Notifications.roomJoined(
            existing.id,
            session.color,
            existing.snapshot(),
          ),
        );

        return;
      }
    }

    // Create or join a game.
    let game: Game;
    if (input.roomId) {
      const found = this.games.get(input.roomId);
      if (!found) {
        log.warn("join attempted on missing room", { roomId: input.roomId });
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

    game.notify(color, Notifications.roomJoined(game.id, color, state));

    if (game.isActive) {
      game.broadcast(Notifications.gameStarted(game.id, state.fen));
    }
  }

  /** @inheritdoc */
  async move(ws: WebSocket, input: MoveInput): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const result = await game.move(color, input);

    if (!result.ok) {
      game.notify(
        color,
        Notifications.moveRejected(
          game.id,
          color,
          result.error,
          input.from,
          input.to,
        ),
      );
      return;
    }

    const snapshot = game.snapshot();
    game.broadcast(
      Notifications.moveMade(game.id, color, result.value, snapshot),
    );
  }

  /** @inheritdoc */
  async requestUndo(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

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
    game.notify(
      opponentColor,
      Notifications.undoRequested(
        game.id,
        color,
        Date.now() + UNDO_REQUEST_TTL_MS,
      ),
    );
  }

  /** @inheritdoc */
  async acceptUndo(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const requestedBy = this.pendingUndos.get(game.id);

    // No pending request, or you can't accept your own — silently ignore
    // rather than invent a dedicated error code for a stale client action.
    if (requestedBy === undefined || requestedBy === color) return;

    this.pendingUndos.delete(game.id);

    const result = await game.undo();
    if (!result.ok) return;

    game.broadcast(Notifications.undoApplied(game.id, game.snapshot()));
  }

  /** @inheritdoc */
  async declineUndo(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const requestedBy = this.pendingUndos.get(game.id);
    if (requestedBy === undefined || requestedBy === color) return;

    this.pendingUndos.delete(game.id);

    game.broadcast(Notifications.undoDeclined(game.id, color));
  }

  /** @inheritdoc */
  async resign(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const result = await game.resign(color);
    if (!result.ok) {
      Reply.send(
        ws,
        Reply.error(GAME_FINISHED, "This game has already finished."),
      );
      return;
    }

    this.pendingUndos.delete(game.id);

    game.broadcast(
      Notifications.gameEnded(game.id, result.value, result.value.winner),
    );
  }

  /** @inheritdoc */
  async leave(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    game.leave(color);
    this.pendingUndos.delete(game.id);

    this.sessions.bind(ws, { roomId: null, color: null, mode: null });
  }

  /** @inheritdoc */
  async sync(ws: WebSocket): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    game.notify(
      color,
      Notifications.roomJoined(game.id, color, game.snapshot()),
    );
  }

  /** @inheritdoc */
  async selectPosition(ws: WebSocket, position: Position): Promise<void> {
    const session = this.getSession(ws);
    if (!session) return;

    const game = this.getGame(ws, session);
    if (!game) return;

    const color = session.color!;

    const result = game.selectPosition(color, position);

    if (!result.ok) {
      game.notify(
        color,
        Notifications.positionRejected(game.id, position, result.error),
      );
      return;
    }

    game.notify(
      color,
      Notifications.positionAccepted(game.id, position, result.value),
    );
  }

  private getSession(ws: WebSocket): Session | null {
    const session = this.sessions.bySocket(ws);
    if (!session) {
      log.warn("action from unauthenticated socket");
      Reply.send(ws, Reply.error(NOT_AUTHENTICATED, "Session not found."));
      return null;
    }
    return session;
  }

  private getGame(ws: WebSocket, session: Session): Game | null {
    if (!session.roomId || session.color === null) {
      log.warn("action from socket not in a game", {
        playerId: session.playerId,
      });
      Reply.send(ws, Reply.error(NOT_IN_GAME, "You are not in a game."));
      return null;
    }

    const game = this.games.get(session.roomId);
    if (!game) {
      log.warn("session referenced a missing room", {
        playerId: session.playerId,
        roomId: session.roomId,
      });
      Reply.send(ws, Reply.error(ROOM_NOT_FOUND, "Room not found."));
      return null;
    }

    return game;
  }
}
