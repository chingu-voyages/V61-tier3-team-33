import { logger as rootLogger } from "../../../logging/logger";
import type { GameStore } from "../../store/game/game-store";
import { ok, type Result } from "../../types";
import { type PlayerContext } from "../../types";

const log = rootLogger.child({ module: "LeaveCommand" });

export class LeaveCommand {
  constructor(private games: GameStore) {}

  run(ctx: PlayerContext): Result<void, void> {
    log.info("[LeaveCommand.run:leaving]", { playerId: ctx.playerId, roomId: ctx.roomId, color: ctx.color });

    // get game — may be null if the game was already swept from memory
    const game = this.games.get(ctx.roomId!);
    if (!game) return ok();

    // execute leave
    game.leave(ctx.color!);

    // Room never started (no opponent ever joined) and is now empty — drop it
    // immediately instead of waiting for the sweeper. Without this, a stale
    // invite link (or a fresh matchmaking search) can land a second player
    // in this now-abandoned room during the sweep TTL window, leaving them
    // waiting alone for an opponent who already left.
    if (game.isWaiting && game.isEmpty) {
      log.info("[LeaveCommand.run:dropping-empty]", { roomId: ctx.roomId });
      this.games.drop(ctx.roomId!);
    }

    return ok();
  }
}
