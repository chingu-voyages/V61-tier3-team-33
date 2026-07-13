import { logger as rootLogger } from "../../../logging/logger";
import { Notifications } from "../../protocol/events";
import type { GameReader } from "../../store/game/game-store";
import { err, type GameError, GameOutcome, ok, type Result } from "../../types";
import { type Move, type MoveInput, type PlayerContext } from "../../types";

const log = rootLogger.child({ module: "MoveCommand" });

export type MoveSuccess = { move: Move; finished: boolean };

export class MoveCommand {
  constructor(private games: GameReader) {}

  async run(ctx: PlayerContext, input: MoveInput): Promise<Result<MoveSuccess, GameError>> {
    log.info("[MoveCommand.run:start]", { playerId: ctx.playerId, from: input.from, to: input.to });

    // get game
    const game = this.games.get(ctx.roomId!)!;

    // execute move
    const result = await game.move(ctx.color!, input);

    // handle rejection
    if (!result.ok) {
      log.warn("[MoveCommand.run:rejected]", { playerId: ctx.playerId, error: result.error });
      game.notify(ctx.color!, Notifications.moveRejected(game.id, ctx.color!, result.error, input.from, input.to));
      return err(result.error);
    }

    log.info("[MoveCommand.run:applied]", { playerId: ctx.playerId, san: result.value.san, finished: game.isFinished });

    // broadcast success
    const snapshot = game.snapshot();
    game.broadcast(Notifications.moveMade(game.id, ctx.color!, result.value, snapshot));

    // checkmate/stalemate/draw ends the game right here — unlike
    // resign/timeout/abandonment, nothing else broadcasts GAME_ENDED for a
    // rules-based ending, so do it ourselves or Mediator.onGameEnded (which
    // force-clears pending undo state, per undo-rules.md rule 9) never fires.
    if (game.isFinished) {
      game.broadcast(Notifications.gameEnded(game.id, GameOutcome.fromSnapshot(snapshot), snapshot.winner));
    }

    return ok({ move: result.value, finished: game.isFinished });
  }
}
