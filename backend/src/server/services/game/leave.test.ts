import { describe, expect, it, mock } from "bun:test";

import type { Game } from "../../store/game/game";
import type { GameReader } from "../../store/game/game-store";
import type { PlayerContext } from "../../types";
import { HUMAN_VS_HUMAN, ok, WHITE } from "../../types";
import { LeaveCommand } from "./leave";

describe("LeaveCommand", () => {
  it("calls game.leave and returns ok", () => {
    const leave = mock(() => {});
    const game = { leave } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new LeaveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(ok());
    expect(leave).toHaveBeenCalledWith(WHITE);
  });

  it("returns ok when game does not exist (was swept)", () => {
    const games: GameReader = { get: mock((): Game | null => null), findWaiting: mock(() => null) };
    const cmd = new LeaveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(ok());
  });
});
