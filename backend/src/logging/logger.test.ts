import { describe, expect, it, spyOn } from "bun:test";

import { DEBUG, ERROR, INFO, JSON_FORMAT, loggingConfig, type LogLevel, WARN } from "./config";
import { logger } from "./logger";

describe("logger", () => {
  // logger.ts's own LEVEL_ORDER isn't exported, so it's reproduced here to
  // compute, from the *real* configured level, whether a given call should
  // be expected to produce output. This makes the suite adapt to whatever
  // LOG_LEVEL/LOG_ENABLED/LOG_FORMAT are active when `bun test` runs,
  // instead of assuming one fixed environment.
  const LEVEL_ORDER: Record<LogLevel, number> = {
    [DEBUG]: 0,
    [INFO]: 1,
    [WARN]: 2,
    [ERROR]: 3,
  };

  function passesLevel(level: LogLevel): boolean {
    const a = LEVEL_ORDER[level];
    const b = LEVEL_ORDER[loggingConfig.level];
    return a !== undefined && b !== undefined && a >= b;
  }

  function withStreamSpies<T>(
    fn: (spies: { stdout: ReturnType<typeof spyOn>; stderr: ReturnType<typeof spyOn> }) => T,
  ): T {
    const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      return fn({ stdout, stderr });
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  }

  it("writes nothing at all when logging is disabled; writes something when enabled", () => {
    withStreamSpies(({ stdout, stderr }) => {
      logger.info("hello");
      logger.error("boom");

      const totalCalls = stdout.mock.calls.length + stderr.mock.calls.length;
      if (loggingConfig.enabled) {
        expect(totalCalls).toBeGreaterThan(0);
      } else {
        expect(totalCalls).toBe(0);
      }
    });
  });

  (["debug", "info", "warn"] as const).forEach((level) => {
    it(`${level}() writes to stdout only when enabled and the level meets the configured minimum`, () => {
      withStreamSpies(({ stdout, stderr }) => {
        logger[level](`${level} message`);

        if (loggingConfig.enabled && passesLevel(level as LogLevel)) {
          expect(stdout).toHaveBeenCalledTimes(1);
        } else {
          expect(stdout).not.toHaveBeenCalled();
        }
        // debug/info/warn must never go to stderr.
        expect(stderr).not.toHaveBeenCalled();
      });
    });
  });

  it("error() writes to stderr (never stdout) only when enabled and error meets the minimum", () => {
    withStreamSpies(({ stdout, stderr }) => {
      logger.error("error message");

      if (loggingConfig.enabled && passesLevel(ERROR)) {
        expect(stderr).toHaveBeenCalledTimes(1);
      } else {
        expect(stderr).not.toHaveBeenCalled();
      }
      expect(stdout).not.toHaveBeenCalled();
    });
  });

  it("includes the message and extra fields in the written output", () => {
    withStreamSpies(({ stdout }) => {
      logger.info("hello world", { userId: "u1" });

      if (!loggingConfig.enabled || !passesLevel(INFO)) {
        expect(stdout).not.toHaveBeenCalled();
        return;
      }

      expect(stdout).toHaveBeenCalledTimes(1);
      const [written] = stdout.mock.calls[0] as [string];

      if (loggingConfig.format === JSON_FORMAT) {
        const parsed = JSON.parse(written);
        expect(parsed.msg).toBe("hello world");
        expect(parsed.level).toBe("info");
        expect(parsed.userId).toBe("u1");
        expect(typeof parsed.time).toBe("number");
      } else {
        expect(written).toContain("hello world");
        expect(written).toContain("u1");
        expect(written).toContain("INFO");
      }
    });
  });

  it("child() merges its context into every subsequent call's fields", () => {
    withStreamSpies(({ stdout }) => {
      const child = logger.child({ module: "test-module" });
      child.info("child message");

      if (!loggingConfig.enabled || !passesLevel(INFO)) {
        expect(stdout).not.toHaveBeenCalled();
        return;
      }

      expect(stdout).toHaveBeenCalledTimes(1);
      const [written] = stdout.mock.calls[0] as [string];

      if (loggingConfig.format === JSON_FORMAT) {
        expect(JSON.parse(written).module).toBe("test-module");
      } else {
        expect(written).toContain("test-module");
      }
    });
  });

  it("child() call-site fields override context fields with the same key", () => {
    withStreamSpies(({ stdout }) => {
      const child = logger.child({ userId: "context-value" });
      child.info("msg", { userId: "call-site-value" });

      if (!loggingConfig.enabled || !passesLevel(INFO)) {
        expect(stdout).not.toHaveBeenCalled();
        return;
      }

      // Works for both formats: the merged fields object only ever has
      // one "userId" entry, and it must be the call-site's value.
      const [written] = stdout.mock.calls[0] as [string];
      expect(written).toContain("call-site-value");
      expect(written).not.toContain("context-value");
    });
  });

  it("child() does not add its context to calls made on the parent logger", () => {
    withStreamSpies(({ stdout }) => {
      logger.child({ module: "child-only" });
      logger.info("parent message");

      if (!loggingConfig.enabled || !passesLevel(INFO) || loggingConfig.format !== JSON_FORMAT) {
        return;
      }

      const [written] = stdout.mock.calls[0] as [string];
      expect(JSON.parse(written).module).toBeUndefined();
    });
  });

  it("child() can be nested, merging grandparent, parent, and call-site fields", () => {
    withStreamSpies(({ stdout }) => {
      const child = logger.child({ a: 1 }).child({ b: 2 });
      child.info("nested", { c: 3 });

      if (!loggingConfig.enabled || !passesLevel(INFO) || loggingConfig.format !== JSON_FORMAT) {
        return;
      }

      const [written] = stdout.mock.calls[0] as [string];
      const parsed = JSON.parse(written);
      expect(parsed.a).toBe(1);
      expect(parsed.b).toBe(2);
      expect(parsed.c).toBe(3);
    });
  });
});
