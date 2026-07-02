import { Elysia } from "elysia";

import type { Protocol } from "../protocol/protocol";
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
} from "../protocol/commands";
import { JsonCodec } from "../protocol/json-codec";
import { Sessions } from "../session/session-store";
import { Connections } from "./connections";
import { Games } from "../game/game-store";
import { GameService } from "../services/game-service";
import { Hub } from "../bus/bus";
import { Reply } from "../protocol/replies";
import { INVALID_PAYLOAD, NOT_IMPLEMENTED } from "../protocol/errors";
import type { WebSocket } from "../domain/types";
import type { GameFacade } from "../services/game-service";
import type { SessionStore } from "../session/sessions";
import type { GameStore } from "../game/games";

export class Gateway {
  private app: Elysia;
  private connections: Connections;
  private gameService: GameFacade;

  constructor(
    private protocol: Protocol = new JsonCodec(),
    sessions: SessionStore = new Sessions(),
    hub: Hub = new Hub(),
    games: GameStore = new Games(hub),
  ) {
    this.connections = new Connections(sessions, hub, protocol);
    this.gameService = new GameService(sessions, games, protocol);
    this.app = new Elysia();
    this.setup();
  }

  private setup(): void {
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
      Reply.send(
        ws,
        Reply.error(INVALID_PAYLOAD, "Unparseable or unknown command."),
      );
      return;
    }

    switch (cmd.type) {
      case SESSION_HANDSHAKE:
        this.connections.identify(ws, cmd.token);
        break;

      case SESSION_PONG:
        this.connections.pong(ws);
        break;

      case ROOM_JOIN:
        this.gameService.join(ws, cmd);
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

      default:
        console.log(`[Gateway] not yet implemented: ${cmd.type}`);
        Reply.send(
          ws,
          Reply.error(NOT_IMPLEMENTED, `${cmd.type} not yet implemented`),
        );
    }
  };

  start(port: number = 3001): void {
    this.app.listen(port, () => {
      console.log(`♟️ Chess server running on port ${port}`);
    });
  }
}
