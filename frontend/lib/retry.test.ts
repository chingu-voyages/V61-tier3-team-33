import { describe, expect, test } from "bun:test"
import { backoffDelay, type RetryConfig } from "./retry"

const config: RetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  jitterRatio: 0.1,
}

describe("backoffDelay", () => {
  test("attempt 0 stays within [baseDelayMs, baseDelayMs * (1 + jitterRatio)]", () => {
    const delay = backoffDelay(0, config)
    expect(delay).toBeGreaterThanOrEqual(config.baseDelayMs)
    expect(delay).toBeLessThanOrEqual(
      config.baseDelayMs * (1 + config.jitterRatio)
    )
  })

  test("grows exponentially before the cap kicks in", () => {
    const delay = backoffDelay(2, config)
    const expectedRaw = config.baseDelayMs * 2 ** 2 // 4000
    expect(delay).toBeGreaterThanOrEqual(expectedRaw)
    expect(delay).toBeLessThanOrEqual(expectedRaw * (1 + config.jitterRatio))
  })

  test("never exceeds maxDelayMs * (1 + jitterRatio) for a large attempt", () => {
    const delay = backoffDelay(20, config)
    expect(delay).toBeLessThanOrEqual(
      config.maxDelayMs * (1 + config.jitterRatio)
    )
  })

  test("is close to maxDelayMs once capped, not still growing", () => {
    const delayAt10 = backoffDelay(10, config)
    const delayAt20 = backoffDelay(20, config)
<<<<<<< HEAD
    // Both should be capped around maxDelayMs, not 2^10 vs 2^20 apart.
=======
    // Both capped at maxDelayMs, not orders of magnitude apart.
>>>>>>> origin/development
    expect(delayAt10).toBeGreaterThanOrEqual(config.maxDelayMs)
    expect(delayAt20).toBeGreaterThanOrEqual(config.maxDelayMs)
  })

  test("jitter only adds on top of the capped delay, never subtracts", () => {
    for (let i = 0; i < 50; i++) {
      const delay = backoffDelay(20, config)
      expect(delay).toBeGreaterThanOrEqual(config.maxDelayMs)
    }
  })

  test("jitter actually varies across calls", () => {
    const results = new Set(
      Array.from({ length: 20 }, () => backoffDelay(5, config))
    )
    expect(results.size).toBeGreaterThan(1)
  })

  test("jitterRatio: 0 returns the deterministic capped delay every time", () => {
    const noJitterConfig: RetryConfig = { ...config, jitterRatio: 0 }
    const first = backoffDelay(3, noJitterConfig)
    const second = backoffDelay(3, noJitterConfig)
    expect(first).toBe(second)
    expect(first).toBe(config.baseDelayMs * 2 ** 3)
  })

  test("jitterRatio: 0 at a capped attempt returns exactly maxDelayMs", () => {
    const noJitterConfig: RetryConfig = { ...config, jitterRatio: 0 }
    expect(backoffDelay(20, noJitterConfig)).toBe(config.maxDelayMs)
  })
})
