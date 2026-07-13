import { EventLog } from "../../logging/events";
import { logger as rootLogger } from "../../logging/logger";
import { Human } from "../occupant/human";
import { Auth } from "../protocol/auth";
import type { Command } from "../protocol/commands";
import {
  GAME_RESIGN,
  MOVE_MAKE,
  POSITION_SELECT,
  ROOM_JOIN,
  ROOM_LEAVE,
  SESSION_HANDSHAKE,
  SESSION_PONG,
  STATE_SYNC,
  UNDO_ACCEPT,
  UNDO_CANCEL,
  UNDO_DECLINE,
  UNDO_REQUEST,
} from "../protocol/commands";
import {
  CLOCK_EXPIRED,
  CONNECTION_CLOSED,
  type Events,
  GAME_ENDED,
  GRACE_EXPIRED,
  MOVE_MADE,
  Notifications,
} from "../protocol/events";
import { Reply } from "../protocol/replies";
import { ServiceRegistry } from "../services/registry";
import { Games } from "../store/game/games";
import { Session } from "../store/session/session";
import { Sessions } from "../store/session/sessions";
import type { ActivePlayerContext, JoinInput, MoveInput, PlayerContext, Position, WebSocket } from "../types";
import { Context, HUMAN_VS_HUMAN, NOT_IMPLEMENTED, NOT_IN_GAME, PieceColor } from "../types";
import { FAST, type Priority } from "../types/priority";
import type { Switcher } from "../util/switcher";
import { RoomSwitcher } from "../util/switcher";
import { type Handler, Hub, type Unsubscribe } from "./hub";

const log = rootLogger.child({ module: "Mediator" });

export class Mediator {
  private hub = new Hub();
  private sessions = new Sessions();
  private games = new Games(this.hub);
  private subscriptions = new Map<string, Unsubscribe>();
  private services = new ServiceRegistry(this.sessions, this.hub, this.games);
  private auth: Auth;
  private switcher: Switcher;
  private eventLog: EventLog;
  private joiningSockets = new Set<string>();

  constructor() {
    this.switcher = new RoomSwitcher(this.games, this.sessions);
    this.auth = new Auth(this.sessions);
    this.eventLog = new EventLog();
    this.eventLog.start(this.hub);
    this.sessions.startPruning();
    this.games.startSweeping();
    this.setup();
  }

  handle(ws: WebSocket, cmd: Command): void {
    log.info("[Mediator.handle:start]", { cmdType: cmd.type });

    if (cmd.type === SESSION_HANDSHAKE) {
      log.info("[Mediator.handle:handshake]", { hasToken: !!cmd.token });
      this.identify(ws, cmd.token);
      return;
    }
    if (cmd.type === SESSION_PONG) {
      log.info("[Mediator.handle:pong]");
      this.pong(ws);
      return;
    }

    // authenticate for game commands
    const ctx = this.auth.resolve(ws);
    if (!ctx) {
      log.warn("[Mediator.handle:unauthenticated]", { cmdType: cmd.type });
      return;
    }

    // dispatch to command handler
    switch (cmd.type) {
      case ROOM_JOIN:
        this.join(ws, ctx, cmd);
        break;
      case ROOM_LEAVE:
        this.leave(ws, ctx);
        break;
      case MOVE_MAKE:
        this.move(ws, ctx, cmd);
        break;
      case UNDO_REQUEST:
        this.requestUndo(ws, ctx);
        break;
      case UNDO_ACCEPT:
        this.acceptUndo(ws, ctx);
        break;
      case UNDO_DECLINE:
        this.declineUndo(ws, ctx);
        break;
      case UNDO_CANCEL:
        this.cancelUndo(ws, ctx);
        break;
      case GAME_RESIGN:
        this.resign(ws, ctx);
        break;
      case STATE_SYNC:
        this.sync(ws, ctx);
        break;
      case POSITION_SELECT:
        this.selectPosition(ws, ctx, cmd.position);
        break;
      default:
        log.warn("[Mediator.handle:unknown-cmd]", { cmdType: (cmd as { type: string }).type });
        Reply.error(ws, NOT_IMPLEMENTED);
    }
  }

  dispose(): void {
    for (const unsub of this.subscriptions.values()) {
      unsub();
    }
    this.subscriptions.clear();
  }

  identify(ws: WebSocket, token?: string): PlayerContext {
    log.info("[Mediator.identify:start]", { hasToken: !!token });

    // authenticate and restore session
    const ctx = this.connection.identify.run(ws, token);
    if (Context.inGame(ctx)) {
      log.info("[Mediator.identify:rejoining]", { playerId: ctx.playerId, roomId: ctx.roomId });
      this.join(ws, ctx, { mode: ctx.mode ?? HUMAN_VS_HUMAN }).catch(() => {});
    }

    return ctx;
  }

  close(ws: WebSocket): void {
    log.info("[Mediator.close:start]");
    this.connection.close.run(ws);
  }

  pong(_ws: WebSocket): void {
    log.info("[Mediator.pong:start]");
  }

  async join(ws: WebSocket, ctx: PlayerContext, input: JoinInput): Promise<void> {
    // prevent duplicate join for same socket (bug 4.10)
    if (this.joiningSockets.has(ws.id)) {
      log.warn("[Mediator.join:duplicate]", { wsId: ws.id });
      return;
    }
    this.joiningSockets.add(ws.id);

    try {
      log.info("[Mediator.join:start]", { playerId: ctx.playerId, roomId: input.roomId, mode: input.mode });

      // capture any in-flight room switch
      const switching = this.switcher.capture(ctx, input, ws);

      // reconnect if staying in same game
      if (!switching && Context.inGame(ctx)) {
        const reconnected = this.reconnect(ws, ctx);
        if (reconnected) {
          log.info("[Mediator.join:reconnected]", { playerId: ctx.playerId, roomId: ctx.roomId });
          return;
        }
      }

      // join or create game
      const occupant = new Human(ctx.playerId, ws);
      const result = await this.game.join.run(input, occupant);
      if (!result.ok) {
        log.warn("[Mediator.join:rejected]", { playerId: ctx.playerId, error: result.error });
        this.switcher.rollback(switching, ws);
        Reply.error(ws, result.error);
        return;
      }

      log.info("[Mediator.join:joined]", { gameId: result.value.gameId, color: result.value.color });

      // commit room switch
      this.switcher.commit(switching);

      // clear any pending undo from the old room
      if (switching) this.game.undo.clear(switching.roomId);

      // reattach if session dropped during async (e.g. close() mid-join)
      if (!this.sessions.bySocket(ws)) {
        this.sessions.reattachSocket(ws, ctx.playerId);
      }

      this.sessions.bind(ws, {
        roomId: result.value.gameId,
        color: result.value.color,
        mode: ctx.mode,
      });
      this.games.commit(result.value.gameId, this.games.get(result.value.gameId)!);
    } finally {
      this.joiningSockets.delete(ws.id);
    }
  }

  async leave(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.leave:start]", { playerId: ctx.playerId });

    // must be in a game to leave
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.leave:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // leave the game room
    const result = this.game.leave.run(ctx);
    if (!result.ok) {
      log.warn("[Mediator.leave:failed]", { playerId: ctx.playerId, error: result.error });
      return;
    }

    // clear session bindings
    log.info("[Mediator.leave:left]", { playerId: ctx.playerId, roomId: ctx.roomId });
    this.game.undo.clear(ctx.roomId!);
    this.sessions.clearSession(ws);
  }

  async move(ws: WebSocket, ctx: PlayerContext, input: MoveInput): Promise<void> {
    log.info("[Mediator.move:start]", { playerId: ctx.playerId });

    // must be in a game to move
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.move:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // apply the move to the board
    const result = await this.game.move.run(ctx, input);
    if (!result.ok) {
      log.warn("[Mediator.move:rejected]", { playerId: ctx.playerId, error: result.error });
      return;
    }

    log.info("[Mediator.move:applied]", { playerId: ctx.playerId });
  }

  async resign(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.resign:start]", { playerId: ctx.playerId });

    // must be in a game to resign
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.resign:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // resign the game
    const result = await this.game.resign.run(ctx);
    if (!result.ok) {
      log.warn("[Mediator.resign:rejected]", { playerId: ctx.playerId, error: result.error });
      Reply.error(ws, result.error);
      return;
    }

    log.info("[Mediator.resign:resigned]", { playerId: ctx.playerId });
  }

  async requestUndo(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.requestUndo:start]", { playerId: ctx.playerId });

    // must be in a game to request undo
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.requestUndo:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // send undo request to opponent
    const result = this.game.undo.request(ctx);
    if (!result.ok) {
      log.warn("[Mediator.requestUndo:rejected]", { playerId: ctx.playerId, error: result.error });
      Reply.error(ws, result.error);
      return;
    }

    log.info("[Mediator.requestUndo:requested]", { playerId: ctx.playerId });
  }

  async acceptUndo(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.acceptUndo:start]", { playerId: ctx.playerId });

    // must be in a game to accept undo
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.acceptUndo:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // accept pending undo request
    const result = await this.game.undo.accept(ctx);
    if (!result.ok) {
      log.warn("[Mediator.acceptUndo:rejected]", { playerId: ctx.playerId, error: result.error });
      Reply.error(ws, result.error);
      return;
    }

    log.info("[Mediator.acceptUndo:accepted]", { playerId: ctx.playerId });
  }

  async declineUndo(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.declineUndo:start]", { playerId: ctx.playerId });

    // must be in a game to decline undo
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.declineUndo:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // decline pending undo request
    const result = this.game.undo.decline(ctx);
    if (!result.ok) {
      log.warn("[Mediator.declineUndo:rejected]", { playerId: ctx.playerId, error: result.error });
      Reply.error(ws, result.error);
      return;
    }

    log.info("[Mediator.declineUndo:declined]", { playerId: ctx.playerId });
  }

  async cancelUndo(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.cancelUndo:start]", { playerId: ctx.playerId });

    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.cancelUndo:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    const result = this.game.undo.cancel(ctx);
    if (!result.ok) {
      log.warn("[Mediator.cancelUndo:rejected]", { playerId: ctx.playerId, error: result.error });
      Reply.error(ws, result.error);
      return;
    }

    log.info("[Mediator.cancelUndo:cancelled]", { playerId: ctx.playerId });
  }

  async sync(ws: WebSocket, ctx: PlayerContext): Promise<void> {
    log.info("[Mediator.sync:start]", { playerId: ctx.playerId });

    // must be in a game to sync
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.sync:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // send full game state snapshot
    log.info("[Mediator.sync:sent]", { playerId: ctx.playerId, roomId: ctx.roomId });
    this.game.sync.run(ctx);
  }

  async selectPosition(ws: WebSocket, ctx: PlayerContext, position: Position): Promise<void> {
    log.info("[Mediator.selectPosition:start]", { playerId: ctx.playerId, position });

    // must be in a game to select position
    if (!Context.inGame(ctx)) {
      log.warn("[Mediator.selectPosition:not-in-game]", { playerId: ctx.playerId });
      Reply.error(ws, NOT_IN_GAME);
      return;
    }

    // update selected position
    const result = this.game.selectPosition.run(ctx, position);
    if (!result.ok) {
      log.warn("[Mediator.selectPosition:rejected]", { playerId: ctx.playerId, error: result.error });
      return;
    }

    log.info("[Mediator.selectPosition:selected]", { playerId: ctx.playerId });
  }

  private get game() {
    return this.services.game;
  }

  private get connection() {
    return this.services.connection;
  }

  private reconnect(ws: WebSocket, ctx: ActivePlayerContext): boolean {
    log.info("[Mediator.reconnect:start]", { playerId: ctx.playerId, roomId: ctx.roomId });

    // look up existing game
    const existing = this.games.get(ctx.roomId);
    if (!existing) {
      log.warn("[Mediator.reconnect:game-not-found]", { roomId: ctx.roomId });
      this.sessions.clearSession(ws);
      return false;
    }

    // reseat player (reuse socket if reconnecting to active game)
    const prevSlot = existing.isFinished ? null : existing.getOccupant(ctx.color);
    existing.reseat(ctx.color, Human.from(ws, ctx.playerId, prevSlot));

    // notify players of reconnection
    existing.notify(ctx.color, Notifications.roomJoined(existing.id, ctx.color, existing.snapshot()));

    if (!existing.isFinished) {
      existing.notify(PieceColor.opponent(ctx.color), Notifications.graceCancelled(existing.id, ctx.color));
    }

    log.info("[Mediator.reconnect:reseated]", {
      playerId: ctx.playerId,
      roomId: ctx.roomId,
      isFinished: existing.isFinished,
    });
    return true;
  }

  private on<T extends string>(type: T, handler: Handler<T>, lane?: Priority): void {
    this.subscriptions.set(type, this.hub.on(type, handler, lane));
  }

  private setup(): void {
    this.on(CONNECTION_CLOSED, this.onConnectionClosed.bind(this));
    this.on(GRACE_EXPIRED, this.onGraceExpired.bind(this), FAST);
    this.on(CLOCK_EXPIRED, this.onClockExpired.bind(this), FAST);
    this.on(GAME_ENDED, this.onGameEnded.bind(this), FAST);
    this.on(MOVE_MADE, this.onMoveMade.bind(this), FAST);
  }

  private onConnectionClosed(_rid: string | null, event: Events<typeof CONNECTION_CLOSED>): void {
    log.info("[Mediator.onConnectionClosed:start]", { playerId: event.playerId });

    // look up player session
    const session = this.sessions.byPlayerId(event.playerId);
    if (!Session.isDisconnected(session) || !Session.inRoom(session)) {
      log.info("[Mediator.onConnectionClosed:no-op]", { playerId: event.playerId });
      return;
    }

    // skip if game is no longer active
    const game = this.games.get(session.roomId);
    if (!game?.isActive) {
      log.info("[Mediator.onConnectionClosed:game-inactive]", { roomId: session.roomId });
      return;
    }

    // notify opponent that grace period started
    log.info("[Mediator.onConnectionClosed:grace-started]", {
      playerId: event.playerId,
      roomId: session.roomId,
      color: session.color,
    });
    game.notify(PieceColor.opponent(session.color), Notifications.graceStarted(game.id, session.color, Date.now()));
  }

  private onGraceExpired(_rid: string | null, event: Events<typeof GRACE_EXPIRED>): void {
    log.info("[Mediator.onGraceExpired:start]", { roomId: event.roomId, color: event.color });

    // look up the game
    const game = this.games.get(event.roomId);
    if (!game) {
      log.warn("[Mediator.onGraceExpired:game-not-found]", { roomId: event.roomId });
      return;
    }

    // check if player reconnected during grace
    if (game.isActive) {
      const occupant = game.getOccupant(event.color);
      if (occupant) {
        const session = this.sessions.byPlayerId(occupant.playerId);
        if (Session.isConnected(session)) {
          log.info("[Mediator.onGraceExpired:reconnected]", { playerId: occupant.playerId });
          return;
        }
      }

      // player did not reconnect — abandon
      log.warn("[Mediator.onGraceExpired:abandoned]", { roomId: event.roomId, color: event.color });
      game.abandon(event.color);
      return;
    }

    if (game.isFinished) {
      log.info("[Mediator.onGraceExpired:already-finished]", { roomId: event.roomId });
      return;
    }

    // remove player from stale game
    const occupant = game.getOccupant(event.color);
    game.leave(event.color);
    this.game.undo.clear(event.roomId);
    if (occupant) {
      this.sessions.clearByPlayerId(occupant.playerId, event.roomId);
    }
    log.info("[Mediator.onGraceExpired:cleaned-up]", { roomId: event.roomId, color: event.color });
  }

  private onClockExpired(_rid: string | null, event: Events<typeof CLOCK_EXPIRED>): void {
    log.info("[Mediator.onClockExpired:start]", { roomId: event.roomId });

    // look up the game
    const game = this.games.get(event.roomId);
    if (!game) {
      log.warn("[Mediator.onClockExpired:game-not-found]", { roomId: event.roomId });
      return;
    }

    // trigger clock expiration
    log.info("[Mediator.onClockExpired:expired]", { roomId: event.roomId });
    game.expire();
  }

  private onGameEnded(_rid: string | null, event: Events<typeof GAME_ENDED>): void {
    log.info("[Mediator.onGameEnded:start]", { roomId: event.roomId });

    // clear pending undo requests
    this.game.undo.clear(event.roomId);
  }

  private onMoveMade(_rid: string | null, event: Events<typeof MOVE_MADE>): void {
    this.game.undo.invalidate(event.roomId);
  }
}
