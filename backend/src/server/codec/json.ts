import { logger as rootLogger } from "../../logging/logger";
import type { Command } from "../protocol/commands";
import type { Codec } from "./codec";

const log = rootLogger.child({ module: "JsonCodec" });
import {
  GAME_RESIGN,
  MOVE_MAKE,
  POSITION_SELECT,
  ROOM_JOIN,
  ROOM_LEAVE,
  SESSION_HANDSHAKE,
  SESSION_PONG,
  STATE_SYNC,
  UNDO_ACCEPT,
  UNDO_CANCEL,
  UNDO_DECLINE,
  UNDO_REQUEST,
  EMOTE_SEND,
} from "../protocol/commands";
import {
  AI_VS_AI,
  BISHOP,
  BLACK,
  BLITZ,
  BULLET,
  CASUAL,
  type ClockFormat,
  DEFAULT,
  EASY,
  HARD,
  HUMAN_VS_AI,
  HUMAN_VS_HUMAN,
  KNIGHT,
  MEDIUM,
  PATIENT,
  QUEEN,
  ROOK,
  STEADY,
  SWIFT,
  WHITE,
} from "../types";

const POSITION_MIN = 0;
const POSITION_MAX = 63;

const isValidPosition = (v: unknown): v is number => typeof v === "number" && v >= POSITION_MIN && v <= POSITION_MAX;
const GAME_MODES: ReadonlySet<number> = new Set([HUMAN_VS_HUMAN, HUMAN_VS_AI, AI_VS_AI]);
const PIECE_COLORS: ReadonlySet<number> = new Set([WHITE, BLACK]);
const DIFFICULTIES: ReadonlySet<number> = new Set([EASY, MEDIUM, HARD]);
const PROMOTION_PIECES: ReadonlySet<number> = new Set([KNIGHT, BISHOP, ROOK, QUEEN]);

const CLOCK_FORMATS: ReadonlySet<string> = new Set([DEFAULT, BULLET, BLITZ, SWIFT, STEADY, PATIENT, CASUAL]);

const optionalClockFormat = (v: unknown): ClockFormat | undefined => {
  if (v === undefined) return undefined;
  if (typeof v === "string" && CLOCK_FORMATS.has(v)) {
    return v as ClockFormat;
  }
  return undefined;
};

type Raw = Record<string, unknown>;

function isPlainObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const optionalString = (v: unknown): string | undefined =>
  v === undefined || typeof v === "string" ? (v as string | undefined) : undefined;

const optionalNumber = (v: unknown): number | undefined =>
  v === undefined || typeof v === "number" ? (v as number | undefined) : undefined;

const optionalEnumNumber = (v: unknown, valid: ReadonlySet<number>): number | undefined => {
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !valid.has(v)) return undefined;
  return v as number;
};

type Decoder = (raw: Raw) => Command | null;

const decoders: Record<Command["type"], Decoder> = {
  [SESSION_HANDSHAKE]: (raw) => {
    if (raw.token !== undefined && typeof raw.token !== "string") return null;
    return { type: SESSION_HANDSHAKE, token: optionalString(raw.token) };
  },

  [SESSION_PONG]: () => ({ type: SESSION_PONG }),

  [ROOM_JOIN]: (raw) => {
    if (typeof raw.mode !== "number" || !GAME_MODES.has(raw.mode)) return null;
    if (raw.roomId !== undefined && typeof raw.roomId !== "string") return null;
    if (raw.color !== undefined && (typeof raw.color !== "number" || !PIECE_COLORS.has(raw.color))) return null;
    if (raw.difficulty !== undefined && (typeof raw.difficulty !== "number" || !DIFFICULTIES.has(raw.difficulty)))
      return null;
    // clock is only honored when creating a new room (no roomId); joining an
    // existing room always uses that room's format, decided server-side.
    if (raw.clock !== undefined && (typeof raw.clock !== "string" || !CLOCK_FORMATS.has(raw.clock))) return null;
    return {
      type: ROOM_JOIN,
      mode: raw.mode,
      roomId: optionalString(raw.roomId),
      color: optionalNumber(raw.color),
      difficulty: optionalEnumNumber(raw.difficulty, DIFFICULTIES),
      clock: optionalClockFormat(raw.clock),
    } as Command;
  },

  [ROOM_LEAVE]: () => ({ type: ROOM_LEAVE }),

  [MOVE_MAKE]: (raw) => {
    if (!isValidPosition(raw.from)) return null;
    if (!isValidPosition(raw.to)) return null;
    if (raw.promoteTo !== undefined && (typeof raw.promoteTo !== "number" || !PROMOTION_PIECES.has(raw.promoteTo)))
      return null;
    return {
      type: MOVE_MAKE,
      from: raw.from,
      to: raw.to,
      promoteTo: optionalEnumNumber(raw.promoteTo, PROMOTION_PIECES),
    } as Command;
  },

  [UNDO_REQUEST]: () => ({ type: UNDO_REQUEST }),
  [UNDO_ACCEPT]: () => ({ type: UNDO_ACCEPT }),
  [UNDO_CANCEL]: () => ({ type: UNDO_CANCEL }),
  [UNDO_DECLINE]: () => ({ type: UNDO_DECLINE }),
  [GAME_RESIGN]: () => ({ type: GAME_RESIGN }),
  [STATE_SYNC]: () => ({ type: STATE_SYNC }),

  [POSITION_SELECT]: (raw) => {
    if (!isValidPosition(raw.position)) return null;
    return { type: POSITION_SELECT, position: raw.position } as Command;
  },

  [EMOTE_SEND]: (raw) => {
    if (typeof raw.emote !== "string") return null;
    return { type: EMOTE_SEND, emote: raw.emote };
  },
};

export class JsonCodec implements Codec {
  decode(raw: unknown): Command | null {
    // validate raw input is a plain object with a type field
    if (!isPlainObject(raw)) {
      log.warn("[JsonCodec.decode:not-object]", { raw: typeof raw === "string" ? raw.slice(0, 200) : typeof raw });
      return null;
    }
    if (typeof raw.type !== "string") {
      log.warn("[JsonCodec.decode:no-type]", { raw: JSON.stringify(raw).slice(0, 200) });
      return null;
    }

    // dispatch to type-specific decoder
    const decode = decoders[raw.type as Command["type"]];
    if (!decode) {
      log.warn("[JsonCodec.decode:unknown-type]", { type: raw.type });
      return null;
    }

    // run decoder and validate result
    const result = decode(raw);
    if (result === null) {
      log.warn("[JsonCodec.decode:validation-fail]", { type: raw.type, raw: JSON.stringify(raw).slice(0, 200) });
    }
    return result;
  }

  encode(message: unknown): string {
    // serialize message to JSON string
    return JSON.stringify(message);
  }
}
