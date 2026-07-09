import {
  INVALID_BASE_DELAY,
  INVALID_MAX_ATTEMPTS,
  INVALID_MAX_DELAY,
  type RetryConfigErrorCode,
} from "../types";
import { logger as rootLogger } from "../../logging/log";

const log = rootLogger.child({ module: "Retry" });

// Default number of attempts before giving up.
const DEFAULT_MAX_ATTEMPTS = 3;

// Default delay before the first retry.
const DEFAULT_BASE_DELAY_MS = 100;

// Default ceiling on how large a backoff delay can grow.
const DEFAULT_MAX_DELAY_MS = 5000;

// Extra random delay added on top of backoff, as a fraction of the delay.
const JITTER_RATIO = 0.1;

// Thrown when Retry is constructed with an invalid configuration.
export class RetryConfigError extends Error {
  constructor(
    public readonly code: RetryConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RetryConfigError";
  }
}

// Retries an async operation with exponential backoff and jitter.
export class Retry {
  constructor(
    private maxAttempts = DEFAULT_MAX_ATTEMPTS,
    private baseDelayMs = DEFAULT_BASE_DELAY_MS,
    private maxDelayMs = DEFAULT_MAX_DELAY_MS,
  ) {
    if (maxAttempts < 1) {
      throw new RetryConfigError(
        INVALID_MAX_ATTEMPTS,
        "maxAttempts must be at least 1",
      );
    }
    if (baseDelayMs < 0) {
      throw new RetryConfigError(
        INVALID_BASE_DELAY,
        "baseDelayMs must not be negative",
      );
    }
    if (maxDelayMs < baseDelayMs) {
      throw new RetryConfigError(
        INVALID_MAX_DELAY,
        "maxDelayMs must not be less than baseDelayMs",
      );
    }
  }

  // Run fn, retrying on failure until it succeeds or attempts run out.
  async run<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        const isLastAttempt = attempt === this.maxAttempts - 1;
        if (!isLastAttempt) {
          const delay = this.backoffDelay(attempt);
          log.warn("attempt failed, retrying", {
            attempt: attempt + 1,
            maxAttempts: this.maxAttempts,
            delayMs: Math.round(delay),
            error: e instanceof Error ? e.message : String(e),
          });
          await Bun.sleep(delay);
        } else {
          log.error("all attempts exhausted", {
            attempts: this.maxAttempts,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    throw lastError;
  }

  // Exponential delay for this attempt, capped and jittered.
  private backoffDelay(attempt: number): number {
    const delay = Math.min(this.baseDelayMs * 2 ** attempt, this.maxDelayMs);
    const jitter = Math.random() * delay * JITTER_RATIO;
    return delay + jitter;
  }
}
