import { RULES, TIMEOUT, RESIGNATION, ABANDONED } from "@/socket/types"
import type { EndReason } from "@/socket/types"
import {
  STALEMATE,
  THREEFOLD_REPETITION,
  FIFTY_MOVE_RULE,
  INSUFFICIENT_MATERIAL,
} from "./game"
import type { DrawReason } from "./game"

export const Reason = {
  endLabel(reason: EndReason): string {
    switch (reason) {
      case RULES:
        return "by checkmate"
      case TIMEOUT:
        return "on time"
      case RESIGNATION:
        return "by resignation"
      case ABANDONED:
        return "by abandonment"
      default:
        return ""
    }
  },

  drawLabel(reason: DrawReason): string {
    switch (reason) {
      case STALEMATE:
        return "Stalemate"
      case THREEFOLD_REPETITION:
        return "Threefold Repetition"
      case FIFTY_MOVE_RULE:
        return "Fifty-Move Rule"
      case INSUFFICIENT_MATERIAL:
        return "Insufficient Material"
      default:
        return "Draw"
    }
  },
}
