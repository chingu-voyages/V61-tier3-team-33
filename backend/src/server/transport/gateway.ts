import { type AnyElysia, Elysia } from "elysia";

import { logger as rootLogger } from "../../logging/logger";
import { getCodec } from "../codec/codec";
import { type Hub } from "../events/hub";
import { Mediator } from "../events/mediator";
import { Command } from "../protocol/commands";
import { Reply } from "../protocol/replies";
import type { Store } from "../store/store";
import { INVALID_PAYLOAD } from "../types";
import { type WebSocket } from "../types";

const log = rootLogger.child({ module: "Gateway" });

export class Gateway {
  readonly plugin: AnyElysia;
  private mediator: Mediator;

  constructor(store: Store, hub: Hub) {
    this.mediator = new Mediator(hub, store);
    this.plugin = new Elysia().ws("/ws", {
      open: this.handleOpen,
      message: this.handleMessage,
      close: this.handleClose,
    });
  }

  private handleOpen = (ws: WebSocket): void => {
    log.info("[Gateway.handleOpen:opened]", { wsId: ws.id });
  };

  private handleClose = (ws: WebSocket): void => {
    log.info("[Gateway.handleClose:closed]", { wsId: ws.id });
    this.mediator.close(ws);
  };

  private handleMessage = (ws: WebSocket, raw: unknown): void => {
    // decode incoming message
    const cmd = getCodec().decode(raw);

    // validate decoded command
    if (!Command.isValid(cmd)) {
      log.warn("[Gateway.handleMessage:decode-fail]", { wsId: ws.id, raw: Command.describe(raw) });
      Reply.error(ws, INVALID_PAYLOAD);
      return;
    }

    // log and route valid command
    log.info("[Gateway.handleMessage:handled]", { wsId: ws.id, cmdType: cmd.type });
    this.mediator.handle(ws, cmd);
  };
}
