import { logger as rootLogger } from "../../../logging/logger";
import { Notifications } from "../../protocol/events";
import type { GameReader } from "../../store/game/game-store";
import { err, type GameError, ok, type Result } from "../../types";
import { type GameOutcome, type PlayerContext } from "../../types";

const log = rootLogger.child({ module: "ResignCommand" });

export class ResignCommand {
  constructor(private games: GameReader) {}

  async run(ctx: PlayerContext): Promise<Result<GameOutcome, GameError>> {
    log.info("[ResignCommand.run:start]", { playerId: ctx.playerId });

    // get game
    const game = this.games.get(ctx.roomId!)!;

    // execute resign
    const result = await game.resign(ctx.color!);
    if (!result.ok) {
      log.warn("[ResignCommand.run:rejected]", { playerId: ctx.playerId, error: result.error });
      return err(result.error);
    }

    log.info("[ResignCommand.run:resigned]", { playerId: ctx.playerId, winner: result.value.winner });

    // broadcast outcome
    game.broadcast(Notifications.gameEnded(game.id, result.value, result.value.winner));
    return ok(result.value);
  }
}
