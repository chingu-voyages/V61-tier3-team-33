import { logger as rootLogger } from "../../../logging/logger";
import type { WebSocket } from "../../types";

const log = rootLogger.child({ module: "PongCommand" });

export class PongCommand {
  run(ws: WebSocket): void {
    log.info("[PongCommand.run:pong]", { wsId: ws.id });
  }
}
