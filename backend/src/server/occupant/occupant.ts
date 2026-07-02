import type { Notification } from "../protocol/events";
import type { OccupantKind } from "../domain/types";

export interface Occupant {
  readonly kind: OccupantKind;
  readonly playerId: string;
  notify(event: Notification): void;
}
