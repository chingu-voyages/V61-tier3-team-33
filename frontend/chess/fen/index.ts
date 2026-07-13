import type { TurnContext } from "../core/state"

import { decodeFEN } from "./decode"
import { encodeFEN } from "./encode"

export class FEN {
  static decode(str: string): TurnContext {
    return decodeFEN(str)
  }

  static encode(ctx: TurnContext): string {
    return encodeFEN(ctx)
  }
}
