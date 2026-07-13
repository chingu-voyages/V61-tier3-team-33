import { describe, expect, it } from "bun:test";

import {
  type Command,
  GAME_RESIGN,
  MOVE_MAKE,
  POSITION_SELECT,
  ROOM_JOIN,
  ROOM_LEAVE,
  SESSION_HANDSHAKE,
  SESSION_PONG,
  STATE_SYNC,
  UNDO_ACCEPT,
  UNDO_DECLINE,
  UNDO_REQUEST,
} from "../protocol/commands";
import { ROOM_JOINED } from "../protocol/events";
import {
  BLITZ,
  BULLET,
  CASUAL,
  DEFAULT,
  EASY,
  type GameSnapshot,
  HUMAN_VS_HUMAN,
  PATIENT,
  STEADY,
  SWIFT,
  WHITE,
} from "../types";
import { JsonCodec } from "./json";

const codec = new JsonCodec();

describe("JsonCodec.decode", () => {
  describe("malformed input", () => {
    it("rejects null", () => {
      expect(codec.decode(null)).toBeNull();
    });

    it("rejects a primitive", () => {
      expect(codec.decode(42)).toBeNull();
      expect(codec.decode("just a string")).toBeNull();
      expect(codec.decode(true)).toBeNull();
    });

    it("rejects an array at the top level", () => {
      expect(codec.decode([1, 2, 3])).toBeNull();
    });

    it("rejects an object with no type field", () => {
      expect(codec.decode({ from: 1, to: 2 })).toBeNull();
    });

    it("rejects an object with a non-string type", () => {
      expect(codec.decode({ type: 123 })).toBeNull();
    });

    it("rejects an unknown type", () => {
      expect(codec.decode({ type: "not:a:real:command" })).toBeNull();
    });
  });

  describe("no-field commands", () => {
    const noFieldTypes = [SESSION_PONG, ROOM_LEAVE, UNDO_REQUEST, UNDO_ACCEPT, UNDO_DECLINE, GAME_RESIGN, STATE_SYNC];

    for (const type of noFieldTypes) {
      it(`decodes ${type} with no extra fields required`, () => {
        const result = codec.decode({ type });
        expect(result).toEqual({ type });
      });
    }
  });

  describe("session:handshake", () => {
    it("decodes without a token", () => {
      const result = codec.decode({ type: SESSION_HANDSHAKE });
      expect(result).toEqual({ type: SESSION_HANDSHAKE, token: undefined });
    });

    it("decodes with a string token", () => {
      const result = codec.decode({ type: SESSION_HANDSHAKE, token: "abc123" });
      expect(result).toEqual({ type: SESSION_HANDSHAKE, token: "abc123" });
    });

    it("rejects a non-string token", () => {
      expect(codec.decode({ type: SESSION_HANDSHAKE, token: 123 })).toBeNull();
    });
  });

  describe("room:join", () => {
    it("decodes with only the required mode field", () => {
      const result = codec.decode({ type: ROOM_JOIN, mode: HUMAN_VS_HUMAN });
      expect(result).toEqual({
        type: ROOM_JOIN,
        mode: HUMAN_VS_HUMAN,
        roomId: undefined,
        color: undefined,
        difficulty: undefined,
      });
    });

    it("decodes with every optional field present", () => {
      const result = codec.decode({
        type: ROOM_JOIN,
        mode: HUMAN_VS_HUMAN,
        roomId: "room-1",
        color: WHITE,
        difficulty: EASY,
      });
      expect(result).toEqual({
        type: ROOM_JOIN,
        mode: HUMAN_VS_HUMAN,
        roomId: "room-1",
        color: WHITE,
        difficulty: EASY,
      });
    });

    it("rejects a missing mode", () => {
      expect(codec.decode({ type: ROOM_JOIN })).toBeNull();
    });

    it("rejects a non-number mode", () => {
      expect(codec.decode({ type: ROOM_JOIN, mode: "human" })).toBeNull();
    });

    it("rejects a non-string roomId", () => {
      expect(codec.decode({ type: ROOM_JOIN, mode: HUMAN_VS_HUMAN, roomId: 5 })).toBeNull();
    });

    it("rejects a non-number color", () => {
      expect(codec.decode({ type: ROOM_JOIN, mode: HUMAN_VS_HUMAN, color: "white" })).toBeNull();
    });

    it("rejects a non-number difficulty", () => {
      expect(
        codec.decode({
          type: ROOM_JOIN,
          mode: HUMAN_VS_HUMAN,
          difficulty: "easy",
        }),
      ).toBeNull();
    });

    describe("clock field", () => {
      it("decodes with a valid clock format", () => {
        for (const fmt of [DEFAULT, BULLET, BLITZ, SWIFT, STEADY, PATIENT, CASUAL]) {
          const result = codec.decode({
            type: ROOM_JOIN,
            mode: HUMAN_VS_HUMAN,
            clock: fmt,
          });
          expect(result).not.toBeNull();
          expect((result! as unknown as { clock: unknown }).clock).toBe(fmt);
        }
      });

      it("defaults clock to undefined when not provided", () => {
        const result = codec.decode({ type: ROOM_JOIN, mode: HUMAN_VS_HUMAN });
        expect((result as unknown as { clock: unknown }).clock).toBeUndefined();
      });

      it("rejects a non-string clock", () => {
        expect(
          codec.decode({
            type: ROOM_JOIN,
            mode: HUMAN_VS_HUMAN,
            clock: 42,
          }),
        ).toBeNull();
      });

      it("rejects an unrecognised clock format", () => {
        expect(
          codec.decode({
            type: ROOM_JOIN,
            mode: HUMAN_VS_HUMAN,
            clock: "lightning",
          }),
        ).toBeNull();
      });
    });
  });

  describe("position:select", () => {
    it("decodes with a numeric position", () => {
      const result = codec.decode({ type: POSITION_SELECT, position: 12 });
      expect(result).toEqual({ type: POSITION_SELECT, position: 12 } as Command);
    });

    it("rejects a non-number position", () => {
      expect(codec.decode({ type: POSITION_SELECT, position: "e2" })).toBeNull();
    });

    it("rejects missing position", () => {
      expect(codec.decode({ type: POSITION_SELECT })).toBeNull();
    });
  });

  describe("move:make", () => {
    it("decodes with from and to only", () => {
      const result = codec.decode({ type: MOVE_MAKE, from: 12, to: 28 });
      expect(result).toEqual({
        type: MOVE_MAKE,
        from: 12,
        to: 28,
        promoteTo: undefined,
      } as Command);
    });

    it("decodes with promoteTo present", () => {
      const result = codec.decode({
        type: MOVE_MAKE,
        from: 12,
        to: 28,
        promoteTo: 4,
      });
      expect(result).toEqual({
        type: MOVE_MAKE,
        from: 12,
        to: 28,
        promoteTo: 4,
      } as Command);
    });

    it("rejects a missing from", () => {
      expect(codec.decode({ type: MOVE_MAKE, to: 28 })).toBeNull();
    });

    it("rejects a missing to", () => {
      expect(codec.decode({ type: MOVE_MAKE, from: 12 })).toBeNull();
    });

    it("rejects a non-number from", () => {
      expect(codec.decode({ type: MOVE_MAKE, from: "e2", to: 28 })).toBeNull();
    });

    it("rejects a non-number promoteTo", () => {
      expect(
        codec.decode({
          type: MOVE_MAKE,
          from: 12,
          to: 28,
          promoteTo: "queen",
        }),
      ).toBeNull();
    });
  });
});

describe("JsonCodec.encode", () => {
  it("serializes a Notification to JSON matching its shape", () => {
    const event = {
      type: ROOM_JOINED,
      roomId: "room-1",
      color: WHITE,
      state: {} as unknown as GameSnapshot,
    } as const;
    const encoded = codec.encode(event);
    expect(JSON.parse(encoded)).toEqual(event);
  });

  it("round-trips through encode then decode-shaped parsing", () => {
    const event = {
      type: ROOM_JOINED,
      roomId: "room-1",
      color: WHITE,
      state: {} as unknown as GameSnapshot,
    } as const;
    const roundTripped = JSON.parse(codec.encode(event));
    expect(roundTripped).toEqual(event);
  });
});
