import { describe, expect, it, mock } from "bun:test";

import { Notifications } from "../../protocol/events";
import type { Game } from "../../store/game/game";
import type { GameReader } from "../../store/game/game-store";
import type { PlayerContext } from "../../types";
import { err, GAME_OVER, HUMAN_VS_HUMAN, IN_PROGRESS, NO_DRAW_REASON, ok, WHITE } from "../../types";
import { type GameOutcome, RESIGNATION } from "../../types";
import { ResignCommand } from "./resign";

describe("ResignCommand", () => {
  it("broadcasts gameEnded and returns ok with outcome on success", async () => {
    const broadcast = mock(() => {});
    const outcome: GameOutcome = {
      status: IN_PROGRESS,
      winner: WHITE,
      hasWinner: true,
      drawReason: NO_DRAW_REASON,
      reason: RESIGNATION,
    };
    const game = { resign: mock(() => Promise.resolve(ok(outcome))), id: "room-1", broadcast } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new ResignCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = await cmd.run(ctx);

    expect(result).toEqual(ok(outcome));
    expect(broadcast).toHaveBeenCalledWith(Notifications.gameEnded("room-1", outcome, WHITE));
  });

  it("returns err when resign fails", async () => {
    const game = {
      resign: mock(() => Promise.resolve(err(GAME_OVER))),
      id: "room-1",
      broadcast: mock(() => {}),
    } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new ResignCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = await cmd.run(ctx);

    expect(result).toEqual(err(GAME_OVER));
  });
});
