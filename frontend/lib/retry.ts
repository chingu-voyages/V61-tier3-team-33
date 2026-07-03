export interface RetryConfig {
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
}

export function backoffDelay(attempt: number, config: RetryConfig): number {
  const raw = config.baseDelayMs * Math.pow(2, attempt)
  const capped = Math.min(raw, config.maxDelayMs)
  const jitter = capped * config.jitterRatio * Math.random()
  return capped + jitter
}
