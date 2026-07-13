import { logger as rootLogger } from "../../logging/logger";
import { CONSENT_ACCEPT, CONSENT_DECLINE, CONSENT_EXPIRE, CONSENT_REQUEST, type ConsentAction } from "../types/consent";

const log = rootLogger.child({ module: "ConsentManager" });

const REQUEST_TIMEOUT_MS = 30 * 1000; // undo/draw requests auto-expire

type PendingEntry<TRequester> = {
  requester: TRequester;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Generic state machine for two-party request → accept/decline/expire flows.
 *
 * One instance shared across undo, draw offers, pause, etc.  Keys must not
 * collide across flows — prefix by flow type (e.g. `"undo:{gameId}"`).
 *
 * State transitions:
 *
 *   ∅ → REQUEST        — first player asks
 *   REQUEST → ACCEPT   — second player agrees (request fulfilled)
 *   REQUEST → DECLINE  — second player refuses (request cancelled)
 *   REQUEST → EXPIRE   — timeout or disconnect (request cancelled)
 *
 * Each transition returns `false` (no-op) if the action is invalid for
 * the current state — callers check the return value and act accordingly.
 */
export class ConsentManager<TKey, TRequester> {
  private pending = new Map<TKey, PendingEntry<TRequester>>();

  /** Hook fired when a pending request auto-expires. Set by the domain owner. */
  onExpire: ((key: TKey) => void) | null = null;

  /**
   * Drive a consent action through the state machine.
   *
   * @param key    — identifies the consent flow (e.g. game/room id)
   * @param action — what the caller wants to do
   * @param actor  — who is performing the action
   * @returns `true` if the transition was accepted, `false` if invalid
   */
  transition(key: TKey, action: ConsentAction, actor: TRequester): boolean {
    const pending = this.pending.get(key);

    switch (action) {
      // The first player opens a consent window.  Only one pending
      // request per key is allowed at a time.  Auto-expires after 30s.
      case CONSENT_REQUEST: {
        if (pending) {
          log.warn("[ConsentManager.transition:request-conflict]", { key, actor });
          return false;
        }

        const timer = setTimeout(() => {
          this.pending.delete(key);
          this.onExpire?.(key);
        }, REQUEST_TIMEOUT_MS);

        this.pending.set(key, { requester: actor, timer });

        log.info("[ConsentManager.transition:requested]", { key, actor });
        return true;
      }

      // The second player responds.
      // The responder must differ from the original requester.
      // The timer is cancelled either way.
      case CONSENT_ACCEPT:
      case CONSENT_DECLINE:
        if (!pending) {
          log.warn("[ConsentManager.transition:no-pending]", { key, action, actor });
          return false;
        }
        if (pending.requester === actor) {
          log.warn("[ConsentManager.transition:self-response]", { key, action, actor });
          return false;
        }

        clearTimeout(pending.timer);
        this.pending.delete(key);

        log.info("[ConsentManager.transition:responded]", { key, action, actor, requester: pending.requester });
        return true;

      // External event (disconnect, game over) forces cleanup
      // regardless of who triggers it.
      case CONSENT_EXPIRE:
        if (!pending) {
          log.warn("[ConsentManager.transition:expire-noop]", { key, actor });
          return false;
        }

        clearTimeout(pending.timer);
        this.pending.delete(key);

        log.info("[ConsentManager.transition:expired]", { key, actor, requester: pending.requester });
        return true;
    }

    return false;
  }

  /** The player who made the pending request, or `null` if none. */
  requester(key: TKey): TRequester | null {
    const entry = this.pending.get(key);
    return entry ? entry.requester : null;
  }

  /** Whether a request is currently pending for this key. */
  isPending(key: TKey): boolean {
    return this.pending.has(key);
  }

  /** Cancel a pending request (game ended, player left, etc.). */
  clear(key: TKey): void {
    const pending = this.pending.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      log.info("[ConsentManager.clear:cleared]", { key, requester: pending.requester });
    } else {
      log.warn("[ConsentManager.clear:noop]", { key });
    }

    this.pending.delete(key);
  }
}
