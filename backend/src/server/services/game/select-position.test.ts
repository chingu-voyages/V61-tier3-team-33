import { describe, expect, it, mock } from "bun:test";

import { Notifications } from "../../protocol/events";
import type { Game } from "../../store/game/game";
import type { GameReader } from "../../store/game/game-store";
import type { PlayerContext } from "../../types";
import { err, GAME_OVER, HUMAN_VS_HUMAN, ok, Position, WHITE } from "../../types";
import { SelectPositionCommand } from "./select-position";

describe("SelectPositionCommand", () => {
  it("notifies positionAccepted and returns ok with moves on success", () => {
    const notify = mock(() => {});
    const moves = [Position(4), Position(5)];
    const game = {
      selectPosition: mock(() => ok(moves)),
      id: "room-1",
      notify,
    } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new SelectPositionCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx, Position(3));

    expect(result).toEqual(ok(moves));
    expect(notify).toHaveBeenCalledWith(WHITE, Notifications.positionAccepted("room-1", Position(3), moves));
  });

  it("notifies positionRejected and returns err when selection rejected", () => {
    const notify = mock(() => {});
    const game = {
      selectPosition: mock(() => err(GAME_OVER)),
      id: "room-1",
      notify,
    } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new SelectPositionCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx, Position(3));

    expect(result).toEqual(err(GAME_OVER));
    expect(notify).toHaveBeenCalledWith(WHITE, Notifications.positionRejected("room-1", Position(3), GAME_OVER));
  });
});
