import type { Notification } from "../protocol/events";
import type { OccupantKind } from "../domain/types";

/** A player seated at a color slot. */
export interface Occupant {
  readonly kind: OccupantKind;
  readonly playerId: string;
  /**
   * Sends a game event to this occupant (e.g. over a WebSocket).
   * @param event — the notification to deliver
   */
  notify(event: Notification): void;
}
