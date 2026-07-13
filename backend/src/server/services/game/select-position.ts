import { logger as rootLogger } from "../../../logging/logger";
import { Notifications } from "../../protocol/events";
import type { GameReader } from "../../store/game/game-store";
import { err, type GameError, ok, type Result } from "../../types";
import { type PlayerContext, type Position } from "../../types";

const log = rootLogger.child({ module: "SelectPositionCommand" });

export class SelectPositionCommand {
  constructor(private games: GameReader) {}

  run(ctx: PlayerContext, position: Position): Result<Position[], GameError> {
    log.info("[SelectPositionCommand.run:start]", { playerId: ctx.playerId, position });

    // get game
    const game = this.games.get(ctx.roomId!)!;

    // execute selection
    const result = game.selectPosition(ctx.color!, position);

    // handle rejection
    if (!result.ok) {
      log.warn("[SelectPositionCommand.run:rejected]", { playerId: ctx.playerId, position, error: result.error });
      game.notify(ctx.color!, Notifications.positionRejected(game.id, position, result.error));
      return err(result.error);
    }

    log.info("[SelectPositionCommand.run:accepted]", { playerId: ctx.playerId, position, moves: result.value.length });

    // handle acceptance
    game.notify(ctx.color!, Notifications.positionAccepted(game.id, position, result.value));
    return ok(result.value);
  }
}
