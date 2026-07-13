import { describe, expect, test } from "bun:test";

import { Snapshot } from "../core/history";
import { NORMAL } from "../core/move";
import { PAWN, WHITE } from "../core/piece";
import type { Position } from "../core/position";
import { A1, A2, B1, B3, C1, C2 } from "../core/position";
import { TurnContext } from "../core/state";
import { getDefaultHistory } from "./default";

describe("MemoryHistory", () => {
  function history() {
    return getDefaultHistory();
  }

  function snap(from: Position = A1, to: Position = A2): Snapshot {
    const ctx = TurnContext.create();
    return Snapshot.create(ctx, {
      type: NORMAL,
      piece: { type: PAWN, color: WHITE },
      from,
      to,
      promoteTo: null,
      captured: null,
    });
  }

  describe("len", () => {
    test("a fresh history has length 0", () => {
      const h = history();

      expect(h.len()).toBe(0);
    });

    test("len reflects the number of entries after pushes and pops", () => {
      const h = history();

      h.push(snap(A1, A2));
      expect(h.len()).toBe(1);

      h.push(snap(B1, B3));
      expect(h.len()).toBe(2);

      h.pop();
      expect(h.len()).toBe(1);

      h.pop();
      expect(h.len()).toBe(0);
    });
  });

  describe("push", () => {
    test("push increases the length by 1", () => {
      const h = history();

      h.push(snap());
      expect(h.len()).toBe(1);

      h.push(snap());
      expect(h.len()).toBe(2);
    });
  });

  describe("pop", () => {
    test("pop on an empty history returns null", () => {
      const h = history();

      expect(h.pop()).toBeNull();
    });

    test("push then pop returns the same entry", () => {
      const h = history();

      h.push(snap(A1, A2));

      const got = h.pop();
      expect(got).not.toBeNull();
      expect(got!.move.from).toBe(A1);
      expect(got!.move.to).toBe(A2);
    });

    test("push three entries then pop returns them in reverse order (LIFO)", () => {
      const h = history();

      h.push(snap(A1, A2)); // bottom
      h.push(snap(B1, B3)); // middle
      h.push(snap(C1, C2)); // top

      expect(h.pop()!.move.to).toBe(C2);
      expect(h.pop()!.move.to).toBe(B3);
      expect(h.pop()!.move.to).toBe(A2);
    });

    test("pop on an emptied history returns null", () => {
      const h = history();

      h.push(snap());
      h.pop();

      expect(h.pop()).toBeNull();
    });
  });

  describe("peek", () => {
    test("peek on an empty history returns null", () => {
      const h = history();

      expect(h.peek()).toBeNull();
    });

    test("peek returns the top entry without removing it", () => {
      const h = history();

      h.push(snap(A1, A2));
      h.push(snap(B1, B3)); // top

      const got = h.peek();
      expect(got).not.toBeNull();
      expect(got!.move.to).toBe(B3);
      expect(h.len()).toBe(2);
    });
  });

  describe("all", () => {
    test("all on an empty history returns an empty array", () => {
      const h = history();

      expect(h.all()).toEqual([]);
    });

    test("all returns entries in push order (oldest first)", () => {
      const h = history();

      h.push(snap(A1, A2)); // oldest
      h.push(snap(B1, B3));
      h.push(snap(C1, C2)); // newest

      const all = h.all();
      expect(all).toHaveLength(3);
      expect(all[0]!.move.to).toBe(A2);
      expect(all[1]!.move.to).toBe(B3);
      expect(all[2]!.move.to).toBe(C2);
    });

    test("all returns a copy — modifying it does not affect the history", () => {
      const h = history();

      h.push(snap(A1, A2));

      const all = h.all();
      all.pop();

      expect(h.len()).toBe(1);
    });
  });

  describe("push / pop round-trip", () => {
    test("push 5 then pop 5 returns to an empty history", () => {
      const h = history();

      for (let i = 0; i < 5; i++) h.push(snap());
      expect(h.len()).toBe(5);

      for (let i = 0; i < 5; i++) {
        expect(h.pop()).not.toBeNull();
      }

      expect(h.len()).toBe(0);
      expect(h.pop()).toBeNull();
    });
  });
});
