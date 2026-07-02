import type { Command } from "./commands";
import type { Notification } from "./events";

/**
 * The wire boundary. Turns raw client input into a validated `Command`,
 * and a `Notification` into a string to send over a socket.
 *
 * This is the only place in the system allowed to distrust its input —
 * everything past this boundary assumes what it's holding is already valid
 * (parse, don't validate). Swap implementations here to change wire format
 * without touching any consumer.
 */
export interface Protocol {
  /**
   * Validates and parses a raw client message.
   *
   * @param raw - The raw string received over the socket.
   * @returns A fully valid `Command`, or `null` if `raw` is malformed,
   *   has an unknown `type`, or is missing/has wrong-shaped fields.
   *   Nothing downstream re-validates a returned `Command`.
   */
  decode(raw: string): Command | null;

  /**
   * Serializes a player-facing event for sending over a socket.
   *
   * @param event - The notification to serialize.
   * @returns The wire string to pass to `ws.send`.
   */
  encode(event: Notification): string;
}
