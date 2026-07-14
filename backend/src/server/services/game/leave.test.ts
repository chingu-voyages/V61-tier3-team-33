import { describe, expect, it, mock } from "bun:test";

import type { Game } from "../../store/game/game";
import type { GameStore } from "../../store/game/game-store";
import type { PlayerContext } from "../../types";
import { HUMAN_VS_HUMAN, ok, WHITE } from "../../types";
import { LeaveCommand } from "./leave";

function makeGames(overrides: Partial<GameStore> = {}): GameStore {
  return {
    get: mock((): Game | null => null),
    findWaiting: mock(() => null),
    create: mock(() => ({}) as Game),
    commit: mock(() => {}),
    drop: mock(() => {}),
    sweep: mock(() => 0),
    startSweeping: mock(() => {}),
    stopSweeping: mock(() => {}),
    ...overrides,
  };
}

describe("LeaveCommand", () => {
  it("calls game.leave and returns ok", () => {
    const leave = mock(() => {});
    const game = { leave, isWaiting: false, isEmpty: false } as unknown as Game;
    const games = makeGames({ get: mock((): Game => game) });
    const cmd = new LeaveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(ok());
    expect(leave).toHaveBeenCalledWith(WHITE);
    expect(games.drop).not.toHaveBeenCalled();
  });

  it("returns ok when game does not exist (was swept)", () => {
    const games = makeGames();
    const cmd = new LeaveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(ok());
  });

  it("drops the room immediately when the last occupant leaves a never-started game", () => {
    // Host leaves a friend-invite room nobody ever joined — should be dropped
    // right away instead of lingering for the sweeper, so a stale invite
    // link or matchmaking search can't land someone in an abandoned room.
    const leave = mock(() => {});
    const game = { leave, isWaiting: true, isEmpty: true } as unknown as Game;
    const games = makeGames({ get: mock((): Game => game) });
    const cmd = new LeaveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = cmd.run(ctx);

    expect(result).toEqual(ok());
    expect(games.drop).toHaveBeenCalledWith("room-1");
  });

  it("does not drop a room that is still occupied after leave", () => {
    const leave = mock(() => {});
    const game = { leave, isWaiting: true, isEmpty: false } as unknown as Game;
    const games = makeGames({ get: mock((): Game => game) });
    const cmd = new LeaveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    cmd.run(ctx);

    expect(games.drop).not.toHaveBeenCalled();
  });
});
