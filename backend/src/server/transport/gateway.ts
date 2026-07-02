import { Elysia } from "elysia";

import type { Protocol } from "../protocol/protocol";
import { SESSION_HANDSHAKE, SESSION_PONG } from "../protocol/commands";
import { JsonCodec } from "../protocol/json-codec";
import { Sessions } from "../session/session-store";
import { Connections } from "./connections";
import { Hub } from "../bus/bus";
import { Reply } from "../protocol/replies";
import { INVALID_PAYLOAD, NOT_IMPLEMENTED } from "../protocol/errors";
import type { WebSocket } from "../domain/types";

export class Gateway {
  private app: Elysia;
  private connections: Connections;

  constructor(
    private protocol: Protocol = new JsonCodec(),
    sessions: Sessions = new Sessions(),
    hub: Hub = new Hub(),
  ) {
    this.connections = new Connections(sessions, hub, protocol);
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
