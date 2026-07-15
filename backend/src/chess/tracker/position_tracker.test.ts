import { describe, expect, test } from "bun:test";

import { getDefaultTracker } from "./default";

describe("PositionTracker", () => {
  function tracker() {
    return getDefaultTracker();
  }

  describe("count", () => {
    test("a fresh tracker reports count 0 for any hash", () => {
      const t = tracker();

      expect(t.count(42n)).toBe(0);
      expect(t.count(0n)).toBe(0);
    });

    test("hash 0 works like any other hash", () => {
      const t = tracker();

      t.record(0n);
      t.record(0n);

      expect(t.count(0n)).toBe(2);

      t.undo(0n);
      expect(t.count(0n)).toBe(1);
    });

    test("different hashes have independent counts", () => {
      const t = tracker();

      t.record(1n);
      t.record(2n);
      t.record(2n);
      t.record(3n);
      t.record(3n);
      t.record(3n);

      expect(t.count(1n)).toBe(1);
      expect(t.count(2n)).toBe(2);
      expect(t.count(3n)).toBe(3);
    });
  });

  describe("record", () => {
    test("recording a hash once gives a count of 1", () => {
      const t = tracker();

      t.record(42n);

      expect(t.count(42n)).toBe(1);
    });

    test("recording the same hash three times gives a count of 3", () => {
      const t = tracker();

      t.record(42n);
      t.record(42n);
      t.record(42n);

      expect(t.count(42n)).toBe(3);
    });
  });

  describe("undo", () => {
    test("undo decrements the count by 1", () => {
      const t = tracker();

      t.record(42n);
      t.record(42n);
      t.record(42n);
      t.undo(42n);

      expect(t.count(42n)).toBe(2);
    });

    test("undo back to zero reports count 0", () => {
      const t = tracker();

      t.record(42n);
      t.undo(42n);

      expect(t.count(42n)).toBe(0);
    });

    test("undo for an unrecorded hash is a no-op", () => {
      const t = tracker();

      t.undo(42n);

      expect(t.count(42n)).toBe(0);
    });

    test("undo more than recorded never goes negative", () => {
      const t = tracker();

      t.record(42n);
      t.undo(42n);
      t.undo(42n);
      t.undo(42n);

      expect(t.count(42n)).toBe(0);
    });

    test("record then undo returns the count to its previous value", () => {
      const t = tracker();

      t.record(42n);
      t.record(42n);
      const original = t.count(42n);

      t.record(42n);
      expect(t.count(42n)).toBe(original + 1);

      t.undo(42n);
      expect(t.count(42n)).toBe(original);
    });
  });

  describe("record / undo interplay", () => {
    test("a sequence of records and undos tracks counts correctly", () => {
      const t = tracker();
      const hashA = 100n;
      const hashB = 200n;
      const hashC = 300n;

      t.record(hashA);
      t.record(hashB);
      t.record(hashC);
      t.record(hashA);
      t.record(hashB);
      t.record(hashC);
      t.record(hashA);

      expect(t.count(hashA)).toBe(3);
      expect(t.count(hashB)).toBe(2);
      expect(t.count(hashC)).toBe(2);

      t.undo(hashA);
      t.undo(hashC);
      t.undo(hashB);

      expect(t.count(hashA)).toBe(2);
      expect(t.count(hashB)).toBe(1);
      expect(t.count(hashC)).toBe(1);
    });

    test("a full game cycle returns all counts to 0", () => {
      const t = tracker();
      const hashes = [1n, 2n, 3n, 1n, 2n, 1n];

      for (const hash of hashes) {
        t.record(hash);
      }

      for (const hash of hashes.toReversed()) {
        t.undo(hash);
      }

      for (const hash of hashes) {
        expect(t.count(hash)).toBe(0);
      }
    });
  });
});
