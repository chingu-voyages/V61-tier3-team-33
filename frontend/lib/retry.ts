<<<<<<< HEAD
=======
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  jitterRatio: 0.1,
}

>>>>>>> origin/development
export interface RetryConfig {
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
}

<<<<<<< HEAD
export function backoffDelay(attempt: number, config: RetryConfig): number {
=======
export function backoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
>>>>>>> origin/development
  const raw = config.baseDelayMs * Math.pow(2, attempt)
  const capped = Math.min(raw, config.maxDelayMs)
  const jitter = capped * config.jitterRatio * Math.random()
  return capped + jitter
}
