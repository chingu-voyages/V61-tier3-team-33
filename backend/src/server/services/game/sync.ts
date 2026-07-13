import { logger as rootLogger } from "../../../logging/logger";
import { Notifications } from "../../protocol/events";
import type { GameReader } from "../../store/game/game-store";
import { ok, type Result } from "../../types";
import { type PlayerContext } from "../../types";

const log = rootLogger.child({ module: "SyncCommand" });

export class SyncCommand {
  constructor(private games: GameReader) {}

  run(ctx: PlayerContext): Result<void, void> {
    log.info("[SyncCommand.run:syncing]", { playerId: ctx.playerId, roomId: ctx.roomId });

    const game = this.games.get(ctx.roomId!)!;
    game.notify(ctx.color!, Notifications.roomJoined(game.id, ctx.color!, game.snapshot()));
    return ok();
  }
}
