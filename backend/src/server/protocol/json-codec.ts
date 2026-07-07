import type { Protocol } from "./protocol";
import type { Command } from "./commands";
import type { Notification } from "./events";
import {
  SESSION_HANDSHAKE,
  SESSION_PONG,
  ROOM_JOIN,
  ROOM_LEAVE,
  MOVE_MAKE,
  UNDO_REQUEST,
  UNDO_ACCEPT,
  UNDO_DECLINE,
  GAME_RESIGN,
  STATE_SYNC,
  POSITION_SELECT,
} from "./commands";

type Raw = Record<string, unknown>;

/** True if value is a plain object (not null, not an array). */
function isPlainObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns v if it's a string or undefined, otherwise undefined. */
const optionalString = (v: unknown): string | undefined =>
  v === undefined || typeof v === "string"
    ? (v as string | undefined)
    : undefined;

/** Returns v if it's a number or undefined, otherwise undefined. */
const optionalNumber = (v: unknown): number | undefined =>
  v === undefined || typeof v === "number"
    ? (v as number | undefined)
    : undefined;

/** Validates one command type's fields and builds the Command, or returns null. */
type Decoder = (raw: Raw) => Command | null;

/**
 * One decoder per `Command["type"]`. A `Record` (not a `switch`) so adding a
 * new `Command` variant without adding its decoder is a compile error —
 * exhaustiveness enforced by the type system, not a runtime `never` check.
 */
const decoders: Record<Command["type"], Decoder> = {
  [SESSION_HANDSHAKE]: (raw) => {
    if (raw.token !== undefined && typeof raw.token !== "string") return null;
    return { type: SESSION_HANDSHAKE, token: optionalString(raw.token) };
  },

  [SESSION_PONG]: () => ({ type: SESSION_PONG }),

  [ROOM_JOIN]: (raw) => {
    if (typeof raw.mode !== "number") return null;
    if (raw.roomId !== undefined && typeof raw.roomId !== "string") return null;
    if (raw.color !== undefined && typeof raw.color !== "number") return null;
    if (raw.difficulty !== undefined && typeof raw.difficulty !== "number")
      return null;
    return {
      type: ROOM_JOIN,
      mode: raw.mode,
      roomId: optionalString(raw.roomId),
      color: optionalNumber(raw.color),
      difficulty: optionalNumber(raw.difficulty),
    } as Command;
  },

  [ROOM_LEAVE]: () => ({ type: ROOM_LEAVE }),

  [MOVE_MAKE]: (raw) => {
    if (typeof raw.from !== "number") return null;
    if (typeof raw.to !== "number") return null;
    if (raw.promoteTo !== undefined && typeof raw.promoteTo !== "number")
      return null;
    return {
      type: MOVE_MAKE,
      from: raw.from,
      to: raw.to,
      promoteTo: optionalNumber(raw.promoteTo),
    } as Command;
  },

  [UNDO_REQUEST]: () => ({ type: UNDO_REQUEST }),
  [UNDO_ACCEPT]: () => ({ type: UNDO_ACCEPT }),
  [UNDO_DECLINE]: () => ({ type: UNDO_DECLINE }),
  [GAME_RESIGN]: () => ({ type: GAME_RESIGN }),
  [STATE_SYNC]: () => ({ type: STATE_SYNC }),

  [POSITION_SELECT]: (raw) => {
    if (typeof raw.position !== "number") return null;
    return { type: POSITION_SELECT, position: raw.position } as Command;
  },
};

/** JSON wire format. */
export class JsonCodec implements Protocol {
  /** {@inheritDoc} */
  decode(raw: unknown): Command | null {
    if (!isPlainObject(raw)) return null;
    if (typeof raw.type !== "string") return null;

    const decode = decoders[raw.type as Command["type"]];
    if (!decode) return null;

    return decode(raw);
  }

  /** {@inheritDoc} */
  encode(event: Notification): string {
    return JSON.stringify(event);
  }
}
