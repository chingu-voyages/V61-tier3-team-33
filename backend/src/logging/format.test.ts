import { describe, expect, it, mock } from "bun:test";

import { Format } from "./format";

describe("dim", () => {
  it("wraps text in the dim ANSI code and resets after", () => {
    expect(Format.dim("hello")).toBe("\x1b[2mhello\x1b[0m");
  });

  it("wraps an empty string the same way", () => {
    expect(Format.dim("")).toBe("\x1b[2m\x1b[0m");
  });
});

describe("paint", () => {
  it("wraps text in the given color code and resets after", () => {
    expect(Format.paint("\x1b[36m", "cyan text")).toBe("\x1b[36mcyan text\x1b[0m");
  });

  it("works with an empty color code (still resets)", () => {
    expect(Format.paint("", "plain")).toBe("plain\x1b[0m");
  });
});

describe("timestamp", () => {
  it("formats a given epoch time as HH:MM:SS.mmm (UTC)", () => {
    const time = Date.UTC(2024, 0, 15, 13, 5, 9, 42);
    expect(Format.timestamp(time)).toBe("13:05:09.042");
  });

  it("pads single-digit hours/minutes/seconds/millis with leading zeros", () => {
    const time = Date.UTC(2024, 0, 1, 1, 2, 3, 4);
    expect(Format.timestamp(time)).toBe("01:02:03.004");
  });

  it("handles midnight correctly", () => {
    const time = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
    expect(Format.timestamp(time)).toBe("00:00:00.000");
  });

  it("defaults to the current time when no argument is given", () => {
    expect(Format.timestamp()).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});

describe("truncate", () => {
  it("returns the string unchanged when under the max length", () => {
    expect(Format.truncate("hello", 10)).toBe("hello");
  });

  it("returns the string unchanged when exactly at the max length", () => {
    expect(Format.truncate("hello", 5)).toBe("hello");
  });

  it("cuts the string and appends the count of removed chars when over max", () => {
    const text = "a".repeat(10);
    expect(Format.truncate(text, 4)).toBe("aaaa…(+6c)");
  });

  it("handles max of 0 by cutting everything", () => {
    expect(Format.truncate("abc", 0)).toBe("…(+3c)");
  });

  it("handles an empty string", () => {
    expect(Format.truncate("", 5)).toBe("");
  });
});

describe("writeJsonLine", () => {
  it("writes the JSON-serialized data followed by a newline", () => {
    const write = mock(() => true);
    const stream = { write } as unknown as NodeJS.WritableStream;

    Format(stream, { a: 1, b: "two" });

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('{"a":1,"b":"two"}\n');
  });

  it("serializes an empty object correctly", () => {
    const write = mock(() => true);
    const stream = { write } as unknown as NodeJS.WritableStream;

    Format(stream, {});

    expect(write).toHaveBeenCalledWith("{}\n");
  });

  it("serializes nested structures correctly", () => {
    const write = mock(() => true);
    const stream = { write } as unknown as NodeJS.WritableStream;

    Format(stream, { nested: { list: [1, 2, 3] } });

    expect(write).toHaveBeenCalledWith('{"nested":{"list":[1,2,3]}}\n');
  });
});
