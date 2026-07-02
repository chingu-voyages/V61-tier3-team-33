import { describe, expect, it } from "bun:test";
import { JsonCodec } from "./json-codec";
import {
  SESSION_HELLO,
  SESSION_PONG,
  ROOM_JOIN,
  ROOM_LEAVE,
  MOVE_MAKE,
  UNDO_REQUEST,
  UNDO_ACCEPT,
  UNDO_DECLINE,
  GAME_RESIGN,
  STATE_SYNC,
  type Command,
} from "./commands";
import { ROOM_JOINED } from "./events";
import { HUMAN_VS_HUMAN, WHITE, EASY } from "../domain/types";

const codec = new JsonCodec();

describe("JsonCodec.decode", () => {
  describe("malformed input", () => {
    it("rejects invalid JSON", () => {
      expect(codec.decode("{not json")).toBeNull();
    });

    it("rejects a JSON array at the top level", () => {
      expect(codec.decode("[1,2,3]")).toBeNull();
    });

    it("rejects a JSON primitive at the top level", () => {
      expect(codec.decode('"just a string"')).toBeNull();
      expect(codec.decode("42")).toBeNull();
      expect(codec.decode("null")).toBeNull();
    });

    it("rejects an object with no type field", () => {
      expect(codec.decode(JSON.stringify({ from: 1, to: 2 }))).toBeNull();
    });

    it("rejects an object with a non-string type", () => {
      expect(codec.decode(JSON.stringify({ type: 123 }))).toBeNull();
    });

    it("rejects an unknown type", () => {
      expect(
        codec.decode(JSON.stringify({ type: "not:a:real:command" })),
      ).toBeNull();
    });
  });

  describe("no-field commands", () => {
    const noFieldTypes = [
      SESSION_PONG,
      ROOM_LEAVE,
      UNDO_REQUEST,
      UNDO_ACCEPT,
      UNDO_DECLINE,
      GAME_RESIGN,
      STATE_SYNC,
    ];

    for (const type of noFieldTypes) {
      it(`decodes ${type} with no extra fields required`, () => {
        const result = codec.decode(JSON.stringify({ type }));
        expect(result).toEqual({ type });
      });
    }
  });

  describe("session:hello", () => {
    it("decodes without a token", () => {
      const result = codec.decode(JSON.stringify({ type: SESSION_HELLO }));
      expect(result).toEqual({ type: SESSION_HELLO, token: undefined });
    });

    it("decodes with a string token", () => {
      const result = codec.decode(
        JSON.stringify({ type: SESSION_HELLO, token: "abc123" }),
      );
      expect(result).toEqual({ type: SESSION_HELLO, token: "abc123" });
    });

    it("rejects a non-string token", () => {
      const result = codec.decode(
        JSON.stringify({ type: SESSION_HELLO, token: 123 }),
      );
      expect(result).toBeNull();
    });
  });

  describe("room:join", () => {
    it("decodes with only the required mode field", () => {
      const result = codec.decode(
        JSON.stringify({ type: ROOM_JOIN, mode: HUMAN_VS_HUMAN }),
      );
      expect(result).toEqual({
        type: ROOM_JOIN,
        mode: HUMAN_VS_HUMAN,
        roomId: undefined,
        color: undefined,
        difficulty: undefined,
      });
    });

    it("decodes with every optional field present", () => {
      const result = codec.decode(
        JSON.stringify({
          type: ROOM_JOIN,
          mode: HUMAN_VS_HUMAN,
          roomId: "room-1",
          color: WHITE,
          difficulty: EASY,
        }),
      );
      expect(result).toEqual({
        type: ROOM_JOIN,
        mode: HUMAN_VS_HUMAN,
        roomId: "room-1",
        color: WHITE,
        difficulty: EASY,
      });
    });

    it("rejects a missing mode", () => {
      expect(codec.decode(JSON.stringify({ type: ROOM_JOIN }))).toBeNull();
    });

    it("rejects a non-number mode", () => {
      expect(
        codec.decode(JSON.stringify({ type: ROOM_JOIN, mode: "human" })),
      ).toBeNull();
    });

    it("rejects a non-string roomId", () => {
      expect(
        codec.decode(
          JSON.stringify({ type: ROOM_JOIN, mode: HUMAN_VS_HUMAN, roomId: 5 }),
        ),
      ).toBeNull();
    });

    it("rejects a non-number color", () => {
      expect(
        codec.decode(
          JSON.stringify({
            type: ROOM_JOIN,
            mode: HUMAN_VS_HUMAN,
            color: "white",
          }),
        ),
      ).toBeNull();
    });

    it("rejects a non-number difficulty", () => {
      expect(
        codec.decode(
          JSON.stringify({
            type: ROOM_JOIN,
            mode: HUMAN_VS_HUMAN,
            difficulty: "easy",
          }),
        ),
      ).toBeNull();
    });
  });

  describe("move:make", () => {
    it("decodes with from and to only", () => {
      const result = codec.decode(
        JSON.stringify({ type: MOVE_MAKE, from: 12, to: 28 }),
      );
      expect(result).toEqual({
        type: MOVE_MAKE,
        from: 12,
        to: 28,
        promoteTo: undefined,
      } as Command);
    });

    it("decodes with promoteTo present", () => {
      const result = codec.decode(
        JSON.stringify({ type: MOVE_MAKE, from: 12, to: 28, promoteTo: 4 }),
      );
      expect(result).toEqual({
        type: MOVE_MAKE,
        from: 12,
        to: 28,
        promoteTo: 4,
      } as Command);
    });

    it("rejects a missing from", () => {
      expect(
        codec.decode(JSON.stringify({ type: MOVE_MAKE, to: 28 })),
      ).toBeNull();
    });

    it("rejects a missing to", () => {
      expect(
        codec.decode(JSON.stringify({ type: MOVE_MAKE, from: 12 })),
      ).toBeNull();
    });

    it("rejects a non-number from", () => {
      expect(
        codec.decode(JSON.stringify({ type: MOVE_MAKE, from: "e2", to: 28 })),
      ).toBeNull();
    });

    it("rejects a non-number promoteTo", () => {
      expect(
        codec.decode(
          JSON.stringify({
            type: MOVE_MAKE,
            from: 12,
            to: 28,
            promoteTo: "queen",
          }),
        ),
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
      state: {} as any,
    } as const;
    const encoded = codec.encode(event);
    expect(JSON.parse(encoded)).toEqual(event);
  });

  it("round-trips through encode then decode-shaped parsing", () => {
    const event = {
      type: ROOM_JOINED,
      roomId: "room-1",
      color: WHITE,
      state: {} as any,
    } as const;
    const roundTripped = JSON.parse(codec.encode(event));
    expect(roundTripped).toEqual(event);
  });
});
