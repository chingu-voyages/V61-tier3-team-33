import { logger as rootLogger } from "../../../logging/logger";
import type { GameReader } from "../../store/game/game-store";
import { ok, type Result } from "../../types";
import { type PlayerContext } from "../../types";

const log = rootLogger.child({ module: "LeaveCommand" });

export class LeaveCommand {
  constructor(private games: GameReader) {}

  run(ctx: PlayerContext): Result<void, void> {
    log.info("[LeaveCommand.run:leaving]", { playerId: ctx.playerId, roomId: ctx.roomId, color: ctx.color });

    // get game — may be null if the game was already swept from memory
    const game = this.games.get(ctx.roomId!);
    if (!game) return ok();

    // execute leave
    game.leave(ctx.color!);
    return ok();
  }
}
