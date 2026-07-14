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

    // resolve game: explicit create, existing room, waiting queue, or fresh match
    let game: ReturnType<GameStore["get"]>;

    if (input.create) {
      // friend-invite flow — always spin up a brand-new room, ignore any roomId
      game = this.games.create(crypto.randomUUID(), input.mode, createClock(format));
      log.info("[JoinCommand.run:created]", { gameId: game.id });
    } else if (input.roomId !== undefined) {
      // explicit room requested (invite link, reconnect) — must already exist
      game = this.games.get(input.roomId);
      if (game === null) {
        log.warn("[JoinCommand.run:room-not-found]", { roomId: input.roomId });
        return err(ROOM_NOT_FOUND);
      }
    } else {
      // matchmaking: no explicit roomId, find a waiting opponent
      game = this.games.findWaiting(input.mode, format);
      if (game) {
        log.info("[JoinCommand.run:matched]", { gameId: game.id });
      } else {
        game = this.games.create(crypto.randomUUID(), input.mode, createClock(format));
        log.info("[JoinCommand.run:created]", { gameId: game.id });
      }
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
