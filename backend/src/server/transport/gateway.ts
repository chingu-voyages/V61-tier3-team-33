import { Elysia } from "elysia";

import type { Codec } from "../codec/codec";
import {
  SESSION_HANDSHAKE,
  SESSION_PONG,
  ROOM_JOIN,
  MOVE_MAKE,
  UNDO_REQUEST,
  UNDO_ACCEPT,
  UNDO_DECLINE,
  GAME_RESIGN,
  STATE_SYNC,
  ROOM_LEAVE,
  POSITION_SELECT,
} from "../protocol/commands";
import { JsonCodec } from "../codec/json";
import { Sessions } from "../session/sessions";
import { Connections } from "./connections";
import { Games } from "../game/games";
import { GameService } from "../services/game-service";
import { Hub } from "../bus/bus";
import { EventLog } from "../../logging/events";
import { logger as rootLogger } from "../../logging/log";
import { Reply } from "../protocol/replies";
import { INVALID_PAYLOAD, NOT_IMPLEMENTED } from "../protocol/errors";
import { HUMAN_VS_HUMAN, type WebSocket } from "../types";
import type { GameFacade } from "../services/game-facade";
import type { SessionStore } from "../session/session-store";
import type { GameStore } from "../game/game-store";

const log = rootLogger.child({ module: "Gateway" });

export class Gateway {
  private app: Elysia;
  private connections: Connections;
  private gameService: GameFacade;
  private EventLog: EventLog;

  constructor(
    private protocol: Codec = new JsonCodec(),
    sessions: SessionStore = new Sessions(),
    hub: Hub = new Hub(),
    games: GameStore = new Games(hub),
  ) {
    this.connections = new Connections(sessions, hub, protocol);
    this.gameService = new GameService(sessions, games, protocol, hub);
    this.EventLog = new EventLog();
    this.EventLog.start(hub);
    this.app = new Elysia();
    this.setup();
  }

  private setup(): void {
    this.app.get("/health", () => ({ status: "ok" }));
    this.app.ws("/ws", {
      open: this.handleOpen,
      message: this.handleMessage,
      close: this.handleClose,
    });
  }

  private handleOpen = (): void => {
    // Nothing yet — the client must send session:handshake first.
  };

  private handleClose = (ws: WebSocket): void => {
    this.connections.close(ws);
  };

  private handleMessage = (ws: WebSocket, raw: unknown): void => {
    const cmd = this.protocol.decode(raw);

    if (cmd === null) {
      log.warn("unparseable or unknown command received");
      Reply.send(
        ws,
        Reply.error(INVALID_PAYLOAD, "Unparseable or unknown command."),
      );
      return;
    }

    switch (cmd.type) {
      case SESSION_HANDSHAKE: {
        const session = this.connections.identify(ws, cmd.token);

        // A reload/reconnect resumes a session that may already be seated
        // in an active room. The client has no way to know that on its
        // own (its in-memory game state was just wiped by the reload), so
        // proactively replay the rejoin here instead of waiting for a
        // room:join the client isn't going to send. GameService.join's
        // "Rejoin on reconnect" branch keys off session.roomId/color, not
        // the input payload, so the mode passed here is a required-but-
        // unused placeholder.
        if (session.roomId && session.color !== null) {
          this.gameService.join(ws, { mode: session.mode ?? HUMAN_VS_HUMAN });
        }
        break;
      }

      case SESSION_PONG:
        this.connections.pong(ws);
        break;

      case ROOM_JOIN:
        this.gameService.join(ws, cmd);
        break;

      case ROOM_LEAVE:
        this.gameService.leave(ws);
        break;

      case MOVE_MAKE:
        this.gameService.move(ws, cmd);
        break;

      case UNDO_REQUEST:
        this.gameService.requestUndo(ws);
        break;

      case UNDO_ACCEPT:
        this.gameService.acceptUndo(ws);
        break;

      case UNDO_DECLINE:
        this.gameService.declineUndo(ws);
        break;

      case GAME_RESIGN:
        this.gameService.resign(ws);
        break;

      case STATE_SYNC:
        this.gameService.sync(ws);
        break;

      case POSITION_SELECT:
        this.gameService.selectPosition(ws, cmd.position);
        break;
    }
  };

  start(port: number = 3001): void {
    this.app.listen(port, () => {
      log.info("chess server running", { port });
    });
  }
}
