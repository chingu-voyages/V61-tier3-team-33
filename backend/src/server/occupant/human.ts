import { logger as rootLogger } from "../../logging/logger";
import { getCodec } from "../codec/codec";
import type { Notification } from "../protocol/events";
import type { WebSocket } from "../types";
import { HUMAN } from "../types";
import type { Occupant } from "./occupant";

const log = rootLogger.child({ module: "Human" });

export class Human implements Occupant {
  readonly kind = HUMAN;

  constructor(
    readonly playerId: string,
    private ws: WebSocket,
  ) {
    // log human occupant creation
    log.info("[Human.constructor:init]", { playerId, wsId: ws.id });
  }

  /** Returns the existing Human with a new socket, or creates a fresh one. */
  static from(ws: WebSocket, playerId: string, occupant: Occupant | null): Human {
    // decide whether to replace existing occupant or create new one
    const isReplacement = occupant instanceof Human;
    log.info("[Human.from:resolved]", { playerId, wsId: ws.id, isReplacement });
    return isReplacement ? occupant.replaceSocket(ws) : new Human(playerId, ws);
  }

  notify(event: Notification): void {
    // log and send notification to the player
    log.info("[Human.notify:sending]", {
      playerId: this.playerId,
      wsId: this.ws.id,
      eventType: event.type,
    });
    this.ws.send(getCodec().encode(event));
  }

  replaceSocket(ws: WebSocket): Human {
    // log socket replacement and return new Human instance
    log.info("[Human.replaceSocket:replacing]", { playerId: this.playerId, oldWsId: this.ws.id, newWsId: ws.id });
    return new Human(this.playerId, ws);
  }
}
