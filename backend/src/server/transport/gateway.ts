import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { logger as rootLogger } from "../../logging/logger";
import { getCodec } from "../codec/codec";
import { Mediator } from "../events/mediator";
import { Command } from "../protocol/commands";
import { Reply } from "../protocol/replies";
import { INVALID_PAYLOAD } from "../types";
import { type WebSocket } from "../types";

const log = rootLogger.child({ module: "Gateway" });

export class Gateway {
  public app: Elysia;
  private mediator: Mediator;

  constructor() {
    this.mediator = new Mediator();
    this.app = new Elysia()
    .use(
      cors({
        origin: "http://localhost:4000",
        credentials: true,
      })
    );
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

  start(port: number = 3001): void {
    this.app.listen(port, () => {
      log.info("chess server running", { port });
    });
  }
}
