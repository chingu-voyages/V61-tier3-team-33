import type { Occupant } from "./occupant";
import type { Protocol } from "../protocol/protocol";
import type { Notification } from "../protocol/events";
import type { WebSocket } from "../domain/types";
import { HUMAN } from "../domain/types";

/**
 * A human player at a color slot. Holds the live socket and sends
 * events over it — it does I/O, so it lives outside `domain/`.
 */
export class Human implements Occupant {
  readonly kind = HUMAN;

  constructor(
    readonly playerId: string,
    private ws: WebSocket,
    private protocol: Protocol,
  ) {}

  /** {@inheritDoc} */
  notify(event: Notification): void {
    this.ws.send(this.protocol.encode(event));
  }

  /**
   * Returns a new `Human` bound to a different socket, e.g. on reconnect.
   * This instance is unchanged — `Human` is immutable.
   */
  replaceSocket(ws: WebSocket): Human {
    return new Human(this.playerId, ws, this.protocol);
  }
}
