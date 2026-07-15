import { describe, expect, it, mock } from "bun:test";

import { Notifications } from "../../protocol/events";
import type { Game } from "../../store/game/game";
import type { GameReader } from "../../store/game/game-store";
import { err, GAME_NOT_FOUND, type GameSnapshot, HUMAN_VS_HUMAN, ok, type PlayerContext, WHITE } from "../../types";
import { SyncCommand } from "./sync";

describe("SyncCommand", () => {
  it("notifies the player with roomJoined on success", () => {
    const notify = mock(() => {});
    const snapshot = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" } as GameSnapshot;
    const game = { id: "room-1", notify, snapshot: () => snapshot } as unknown as Game;
    const games: GameReader = {
      get: mock((): Game => game),
      findWaiting: mock(() => null),
    };
    const cmd = new SyncCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(ok());
    expect(notify).toHaveBeenCalledWith(WHITE, Notifications.roomJoined("room-1", WHITE, snapshot));
  });

  it("returns GAME_NOT_FOUND when the game has been swept", () => {
    const games: GameReader = {
      get: mock((): Game | null => null),
      findWaiting: mock(() => null),
    };
    const cmd = new SyncCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(err(GAME_NOT_FOUND));
  });
});
