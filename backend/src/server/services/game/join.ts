import { logger as rootLogger } from "../../../logging/logger";
import { createClock } from "../../clock/factory";
import type { Occupant } from "../../occupant/occupant";
import { Notifications } from "../../protocol/events";
import type { GameStore } from "../../store/game/game-store";
import { err, ok, type Result, ROOM_FULL, ROOM_NOT_FOUND, type RoomError } from "../../types";
import { BLITZ, type JoinInput, type PieceColor } from "../../types";

const log = rootLogger.child({ module: "JoinCommand" });

export type JoinSuccess = { gameId: string; color: PieceColor };

export class JoinCommand {
  constructor(private games: GameStore) {}

  async run(input: JoinInput, occupant: Occupant): Promise<Result<JoinSuccess, RoomError>> {
    const format = input.clock ?? BLITZ;

    // resolve game: existing room, waiting queue, or create new
    let game = input.roomId === undefined ? null : this.games.get(input.roomId);
    if (input.roomId !== undefined && !game) {
      log.warn("[JoinCommand.run:room-not-found]", { roomId: input.roomId });
      return err(ROOM_NOT_FOUND);
    }

    if (game === null) {
      const waiting = this.games.findWaiting(input.mode, format);
      game = waiting ?? this.games.create(undefined, input.mode, createClock(format));
      log.info("[JoinCommand.run:resolved]", { gameId: game.id, source: waiting ? "waiting" : "created" });
    }

    // assign color
    const color = input.color ?? game.nextColor();
    if (color === null) {
      log.warn("[JoinCommand.run:full]", { roomId: game.id });
      return err(ROOM_FULL);
    }

    // execute join
    const joinResult = game.join(color, occupant);
    if (!joinResult.ok) {
      log.warn("[JoinCommand.run:rejected]", { roomId: game.id, color, error: joinResult.error });
      return err(joinResult.error);
    }

    log.info("[JoinCommand.run:success]", { playerId: occupant.playerId, roomId: game.id, color });

    // notify participants
    const snapshot = game.snapshot();
    game.notify(color, Notifications.roomJoined(game.id, color, snapshot));

    if (game.isActive) {
      game.broadcast(Notifications.gameStarted(game.id, snapshot.fen, snapshot.turn, snapshot.clock));
      log.info("[JoinCommand.run:started]", { roomId: game.id });
    }

    return ok({ gameId: game.id, color });
  }
}
