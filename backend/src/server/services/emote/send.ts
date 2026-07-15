import { logger as rootLogger } from "../../../logging/logger";
import { Notifications } from "../../protocol/events";
import type { GameReader } from "../../store/game/game-store";
import { ok, type Result } from "../../types";
import { BLACK, type PlayerContext, WHITE } from "../../types";

const log = rootLogger.child({ module: "SendCommand" });

const EMOTE_COOLDOWN_MS = 7 * 1000;
const ALLOWED_EMOTES = new Set(["👍", "😅", "🤔", "🎉", "😤", "⚡"]);

export class SendCommand {
  private lastEmoteAt = new Map<string, number>();

  constructor(private games: GameReader) {}

  run(ctx: PlayerContext, emote: string): Result<void, void> {
    log.info("[SendCommand.run:start]", { playerId: ctx.playerId, emote });

    if (!ALLOWED_EMOTES.has(emote)) {
      log.warn("[SendCommand.run:invalid]", { playerId: ctx.playerId, emote });
      return ok();
    }

    const game = this.games.get(ctx.roomId!);
    if (!game) {
      log.warn("[SendCommand.run:game-not-found]", { playerId: ctx.playerId });
      return ok();
    }

    const key = `${game.id}:${ctx.color}`;
    const last = this.lastEmoteAt.get(key) ?? 0;
    if (Date.now() - last < EMOTE_COOLDOWN_MS) {
      log.info("[SendCommand.run:cooldown]", { playerId: ctx.playerId });
      return ok();
    }
    this.lastEmoteAt.set(key, Date.now());

    const opponentColor = ctx.color === WHITE ? BLACK : WHITE;
    game.notify(opponentColor, Notifications.emoteReceived(game.id, ctx.color!, emote));
    log.info("[SendCommand.run:sent]", { roomId: game.id, from: ctx.color, emote });

    return ok();
  }
}
