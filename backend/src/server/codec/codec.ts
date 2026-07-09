import type { Command } from "../protocol/commands";
import type { Notification } from "../protocol/events";

export interface Codec {
  decode(raw: unknown): Command | null;
  encode(event: Notification): string;
}
