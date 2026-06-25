import { describe, expect, test } from "bun:test";
import {
  File,
  FILE_A,
  FILE_B,
  FILE_C,
  FILE_D,
  FILE_E,
  FILE_F,
  FILE_G,
  FILE_H,
  Rank,
  RANK_1,
  RANK_2,
  RANK_3,
  RANK_4,
  RANK_5,
  RANK_6,
  RANK_7,
  RANK_8,
  Position,
  NO_POSITION,
  A1,
  A2,
  A8,
  E4,
  H1,
  H8,
} from "./position";

describe("File", () => {
  describe("add", () => {
    test("stays in bounds", () => {
      expect(File.add(FILE_A, 3)).toEqual([FILE_D, true]);
    });

    test("zero delta → identity", () => {
      expect(File.add(FILE_D, 0)).toEqual([FILE_D, true]);
    });

    test("reaches H", () => {
      expect(File.add(FILE_A, 7)).toEqual([FILE_H, true]);
    });

    test("negative delta", () => {
      expect(File.add(FILE_H, -2)).toEqual([FILE_F, true]);
    });

    test("out of bounds high", () => {
      expect(File.add(FILE_H, 1)).toEqual([FILE_A, false]);
    });

    test("out of bounds low", () => {
      expect(File.add(FILE_A, -1)).toEqual([FILE_A, false]);
    });
  });

  describe("toString", () => {
    test.each([
      [FILE_A, "A"],
      [FILE_B, "B"],
      [FILE_C, "C"],
      [FILE_D, "D"],
      [FILE_E, "E"],
      [FILE_F, "F"],
      [FILE_G, "G"],
      [FILE_H, "H"],
    ])("file %i → '%s'", (f, expected) => {
      expect(File.toString(f)).toBe(expected);
    });
  });

  describe("parse", () => {
    test("uppercase", () => expect(File.parse("A")).toBe(FILE_A));
    test("lowercase", () => expect(File.parse("h")).toBe(FILE_H));
    test("mid letter", () => expect(File.parse("D")).toBe(FILE_D));
    test("invalid letter", () => expect(File.parse("Z")).toBeNull());
    test("digit", () => expect(File.parse("1")).toBeNull());
    test("empty string", () => expect(File.parse("")).toBeNull());
    test("multi-char → null", () => expect(File.parse("AB")).toBeNull());

    test("round-trips toString", () => {
      const files = [
        FILE_A,
        FILE_B,
        FILE_C,
        FILE_D,
        FILE_E,
        FILE_F,
        FILE_G,
        FILE_H,
      ];
      for (const f of files) {
        expect(File.parse(File.toString(f))).toBe(f);
      }
    });
  });
});

describe("Rank", () => {
  describe("add", () => {
    test("stays in bounds", () => {
      expect(Rank.add(RANK_1, 3)).toEqual([RANK_4, true]);
    });

    test("zero delta → identity", () => {
      expect(Rank.add(RANK_5, 0)).toEqual([RANK_5, true]);
    });

    test("reaches rank 8", () => {
      expect(Rank.add(RANK_1, 7)).toEqual([RANK_8, true]);
    });

    test("negative delta", () => {
      expect(Rank.add(RANK_8, -2)).toEqual([RANK_6, true]);
    });

    test("out of bounds high", () => {
      expect(Rank.add(RANK_8, 1)).toEqual([RANK_1, false]);
    });

    test("out of bounds low", () => {
      expect(Rank.add(RANK_1, -1)).toEqual([RANK_1, false]);
    });
  });

  describe("toString", () => {
    test.each([
      [RANK_1, "1"],
      [RANK_2, "2"],
      [RANK_3, "3"],
      [RANK_4, "4"],
      [RANK_5, "5"],
      [RANK_6, "6"],
      [RANK_7, "7"],
      [RANK_8, "8"],
    ])("rank %i → '%s'", (r, expected) => {
      expect(Rank.toString(r)).toBe(expected);
    });
  });

  describe("parse", () => {
    test("first rank", () => expect(Rank.parse("1")).toBe(RANK_1));
    test("last rank", () => expect(Rank.parse("8")).toBe(RANK_8));
    test("mid digit", () => expect(Rank.parse("4")).toBe(RANK_4));
    test("out of range digit", () => expect(Rank.parse("9")).toBeNull());
    test("zero digit", () => expect(Rank.parse("0")).toBeNull());
    test("letter", () => expect(Rank.parse("a")).toBeNull());
    test("empty string", () => expect(Rank.parse("")).toBeNull());
    test("multi-char → null", () => expect(Rank.parse("12")).toBeNull());

    test("round-trips toString", () => {
      const ranks = [
        RANK_1,
        RANK_2,
        RANK_3,
        RANK_4,
        RANK_5,
        RANK_6,
        RANK_7,
        RANK_8,
      ];
      for (const r of ranks) {
        expect(Rank.parse(Rank.toString(r))).toBe(r);
      }
    });
  });

  describe("reverse", () => {
    test("rank 1 ↔ rank 8", () => {
      expect(Rank.reverse(RANK_1)).toBe(RANK_8);
      expect(Rank.reverse(RANK_8)).toBe(RANK_1);
    });

    test("rank 2 ↔ rank 7", () => {
      expect(Rank.reverse(RANK_2)).toBe(RANK_7);
      expect(Rank.reverse(RANK_7)).toBe(RANK_2);
    });

    test("rank 3 ↔ rank 6", () => {
      expect(Rank.reverse(RANK_3)).toBe(RANK_6);
      expect(Rank.reverse(RANK_6)).toBe(RANK_3);
    });

    test("centre ranks mirror each other", () => {
      expect(Rank.reverse(RANK_4)).toBe(RANK_5);
      expect(Rank.reverse(RANK_5)).toBe(RANK_4);
    });

    test("is its own inverse", () => {
      const ranks = [
        RANK_1,
        RANK_2,
        RANK_3,
        RANK_4,
        RANK_5,
        RANK_6,
        RANK_7,
        RANK_8,
      ];
      for (const r of ranks) {
        expect(Rank.reverse(Rank.reverse(r))).toBe(r);
      }
    });
  });
});

describe("Position", () => {
  describe("create", () => {
    test("A1 = file A, rank 1", () => {
      expect(Position.create(FILE_A, RANK_1)).toBe(A1);
    });

    test("H8 = file H, rank 8", () => {
      expect(Position.create(FILE_H, RANK_8)).toBe(H8);
    });

    test("E4 = file E, rank 4", () => {
      expect(Position.create(FILE_E, RANK_4)).toBe(E4);
    });
  });

  describe("file", () => {
    test("A1 → file A", () => expect(Position.file(A1)).toBe(FILE_A));
    test("H1 → file H", () => expect(Position.file(H1)).toBe(FILE_H));
    test("E4 → file E", () => expect(Position.file(E4)).toBe(FILE_E));
  });

  describe("rank", () => {
    test("A1 → rank 1", () => expect(Position.rank(A1)).toBe(RANK_1));
    test("A8 → rank 8", () => expect(Position.rank(A8)).toBe(RANK_8));
    test("E4 → rank 4", () => expect(Position.rank(E4)).toBe(RANK_4));
  });

  describe("index", () => {
    test("equals the position value", () => {
      expect(Position.index(A1)).toBe(A1);
      expect(Position.index(H8)).toBe(H8);
      expect(Position.index(E4)).toBe(E4);
    });
  });

  describe("isValid", () => {
    test("A1 is valid", () => expect(Position.isValid(A1)).toBe(true));
    test("H8 is valid", () => expect(Position.isValid(H8)).toBe(true));
    test("NO_POSITION is invalid", () =>
      expect(Position.isValid(NO_POSITION)).toBe(false));
    test("out-of-range value is invalid", () =>
      expect(Position.isValid(Position(65))).toBe(false));
  });

  describe("toString", () => {
    test("A1 → 'A1'", () => expect(Position.toString(A1)).toBe("A1"));
    test("H8 → 'H8'", () => expect(Position.toString(H8)).toBe("H8"));
    test("E4 → 'E4'", () => expect(Position.toString(E4)).toBe("E4"));
    test("NO_POSITION → '-'", () =>
      expect(Position.toString(NO_POSITION)).toBe("-"));
  });

  describe("parse", () => {
    test("'a1' → A1", () => expect(Position.parse("a1")).toBe(A1));
    test("'A1' → A1", () => expect(Position.parse("A1")).toBe(A1));
    test("'h8' → H8", () => expect(Position.parse("h8")).toBe(H8));
    test("'e4' → E4", () => expect(Position.parse("e4")).toBe(E4));
    test("'-' → null", () => expect(Position.parse("-")).toBeNull());
    test("too long → null", () => expect(Position.parse("e44")).toBeNull());
    test("empty string → null", () => expect(Position.parse("")).toBeNull());
    test("too short → null", () => expect(Position.parse("e")).toBeNull());
    test("invalid file → null", () => expect(Position.parse("z4")).toBeNull());
    test("invalid rank → null", () => expect(Position.parse("e9")).toBeNull());

    test("round-trips toString for all 64 squares", () => {
      const files = [
        FILE_A,
        FILE_B,
        FILE_C,
        FILE_D,
        FILE_E,
        FILE_F,
        FILE_G,
        FILE_H,
      ];
      const ranks = [
        RANK_1,
        RANK_2,
        RANK_3,
        RANK_4,
        RANK_5,
        RANK_6,
        RANK_7,
        RANK_8,
      ];
      for (const f of files) {
        for (const r of ranks) {
          const pos = Position.create(f, r);
          expect(Position.parse(Position.toString(pos))).toBe(pos);
        }
      }
    });
  });

  describe("isDarkSquare", () => {
    test("A1 is dark", () => expect(Position.isDarkSquare(A1)).toBe(true));
    test("A2 is light", () => expect(Position.isDarkSquare(A2)).toBe(false));
    test("H8 is dark", () => expect(Position.isDarkSquare(H8)).toBe(true));

    test("alternates across a rank", () => {
      const files = [
        FILE_A,
        FILE_B,
        FILE_C,
        FILE_D,
        FILE_E,
        FILE_F,
        FILE_G,
        FILE_H,
      ];
      for (const f of files) {
        const pos = Position.create(f, RANK_1);
        expect(Position.isDarkSquare(pos)).toBe(f % 2 === 0);
      }
    });

    test("alternates across a file", () => {
      const ranks = [
        RANK_1,
        RANK_2,
        RANK_3,
        RANK_4,
        RANK_5,
        RANK_6,
        RANK_7,
        RANK_8,
      ];
      for (const r of ranks) {
        const pos = Position.create(FILE_A, r);
        expect(Position.isDarkSquare(pos)).toBe(r % 2 === 0);
      }
    });
  });
});
