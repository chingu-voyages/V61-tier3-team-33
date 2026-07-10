import { describe, expect, it } from "bun:test";
import { Retry, RetryConfigError } from "./retry";
import {
  INVALID_MAX_ATTEMPTS,
  INVALID_BASE_DELAY,
  INVALID_MAX_DELAY,
} from "../types";

describe("Retry", () => {
  describe("construction validation", () => {
    it("accepts valid config without throwing", () => {
      expect(() => new Retry(3, 1, 10)).not.toThrow();
    });

    it("accepts defaults with no arguments", () => {
      expect(() => new Retry()).not.toThrow();
    });

    it("rejects maxAttempts less than 1", () => {
      expect(() => new Retry(0, 1, 10)).toThrow(RetryConfigError);
    });

    it("tags the error with INVALID_MAX_ATTEMPTS", () => {
      try {
        new Retry(0, 1, 10);
        throw new Error("expected constructor to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(RetryConfigError);
        expect((e as RetryConfigError).code).toBe(INVALID_MAX_ATTEMPTS);
      }
    });

    it("rejects a negative baseDelayMs", () => {
      try {
        new Retry(3, -1, 10);
        throw new Error("expected constructor to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(RetryConfigError);
        expect((e as RetryConfigError).code).toBe(INVALID_BASE_DELAY);
      }
    });

    it("rejects maxDelayMs smaller than baseDelayMs", () => {
      try {
        new Retry(3, 100, 10);
        throw new Error("expected constructor to throw");
      } catch (e) {
        expect(e).toBeInstanceOf(RetryConfigError);
        expect((e as RetryConfigError).code).toBe(INVALID_MAX_DELAY);
      }
    });

    it("allows maxDelayMs equal to baseDelayMs", () => {
      expect(() => new Retry(3, 50, 50)).not.toThrow();
    });
  });

  describe("run()", () => {
    it("returns the result on first success without retrying", async () => {
      const retry = new Retry(3, 1, 10);
      let calls = 0;

      const result = await retry.run(async () => {
        calls++;
        return "ok";
      });

      expect(result).toBe("ok");
      expect(calls).toBe(1);
    });

    it("retries on failure and succeeds once fn stops throwing", async () => {
      const retry = new Retry(3, 1, 10);
      let calls = 0;

      const result = await retry.run(async () => {
        calls++;
        if (calls < 3) throw new Error(`fail-${calls}`);
        return "recovered";
      });

      expect(result).toBe("recovered");
      expect(calls).toBe(3);
    });

    it("stops after maxAttempts and throws the last error", async () => {
      const retry = new Retry(3, 1, 10);
      let calls = 0;

      const promise = retry.run(async () => {
        calls++;
        throw new Error(`fail-${calls}`);
      });

      await expect(promise).rejects.toThrow("fail-3");

      expect(calls).toBe(3);
    });

    it("makes exactly maxAttempts calls, never more", async () => {
      const retry = new Retry(5, 1, 10);
      let calls = 0;

      const promise = retry.run(async () => {
        calls++;
        throw new Error("always fails");
      });

      await expect(promise).rejects.toThrow("always fails");

      expect(calls).toBe(5);
    });

    it("makes exactly one attempt when maxAttempts is 1", async () => {
      const retry = new Retry(1, 1, 10);
      let calls = 0;

      const promise = retry.run(async () => {
        calls++;
        throw new Error("nope");
      });

      await expect(promise).rejects.toThrow("nope");

      expect(calls).toBe(1);
    });

    it("does not delay after the final failed attempt", async () => {
      const retry = new Retry(2, 1000, 1000); // would take ~1s if it waited after the last attempt
      let calls = 0;

      const start = Date.now();
      const promise = retry.run(async () => {
        calls++;
        throw new Error("boom");
      });

      await expect(promise).rejects.toThrow("boom");

      const elapsed = Date.now() - start;

      expect(calls).toBe(2);
      // One backoff wait (~1000ms) happens between attempt 1 and 2, but none after attempt 2.
      expect(elapsed).toBeLessThan(1800);
    });

    it("propagates non-Error thrown values", async () => {
      const retry = new Retry(1, 1, 10);

      const promise = retry.run(async () => {
        throw "a string failure";
      });

      await expect(promise).rejects.toBe("a string failure");
    });

    it("returns fn's resolved value type unchanged (object result)", async () => {
      const retry = new Retry(2, 1, 10);
      const payload = { ok: true, id: 42 };

      const result = await retry.run(async () => payload);

      expect(result).toBe(payload);
    });
  });
});
