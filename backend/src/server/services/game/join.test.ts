import { describe, expect, it, mock } from "bun:test";

import type { Occupant } from "../../occupant/occupant";
import { Notifications } from "../../protocol/events";
import type { Game } from "../../store/game/game";
import type { GameStore } from "../../store/game/game-store";
import type { JoinInput } from "../../types";
import { err, HUMAN, HUMAN_VS_HUMAN, INVALID_MODE, ok, ROOM_FULL, ROOM_NOT_FOUND, WHITE } from "../../types";
import { JoinCommand } from "./join";

function makeOccupant(): Occupant {
  return { kind: HUMAN, playerId: "p1", notify: mock(() => {}) };
}

describe("JoinCommand", () => {
  it("joins an existing waiting game and returns ok", async () => {
    const notify = mock(() => {});
    const broadcast = mock(() => {});
    const game = {
      id: "room-1",
      nextColor: mock(() => WHITE),
      join: mock(() => ok()),
      snapshot: mock(() => ({ fen: "fen", turn: WHITE, clock: null })),
      isActive: false,
      mode: HUMAN_VS_HUMAN,
      notify,
      broadcast,
    } as unknown as Game;
    const games: GameStore = {
      get: mock((): Game | null => null),
      findWaiting: mock(() => game),
      create: mock(() => ({}) as Game),
      commit: mock(() => {}),
      drop: mock(() => {}),
      sweep: mock(() => 0),
      startSweeping: mock(() => {}),
      stopSweeping: mock(() => {}),
    };
    const cmd = new JoinCommand(games);

    const input: JoinInput = { mode: HUMAN_VS_HUMAN };
    const result = await cmd.run(input, makeOccupant());

    expect(result).toEqual(ok({ gameId: "room-1", color: WHITE }));
    expect(notify).toHaveBeenCalledWith(WHITE, Notifications.roomJoined("room-1", WHITE, expect.any(Object)));
  });

  it("returns err(ROOM_FULL) when game has no available color", async () => {
    const games: GameStore = {
      get: mock((): Game | null => null),
      findWaiting: mock(() => null),
      create: mock(() => {
        const g = { nextColor: mock(() => null) } as unknown as Game;
        return g;
      }),
      commit: mock(() => {}),
      drop: mock(() => {}),
      sweep: mock(() => 0),
      startSweeping: mock(() => {}),
      stopSweeping: mock(() => {}),
    };
    const cmd = new JoinCommand(games);

    const result = await cmd.run({ mode: HUMAN_VS_HUMAN }, makeOccupant());

    expect(result).toEqual(err(ROOM_FULL));
  });

  it("creates a new game with a server-generated ID when create=true, ignoring any roomId", async () => {
    const game = {
      id: crypto.randomUUID(),
      nextColor: mock(() => WHITE),
      join: mock(() => ok()),
      snapshot: mock(() => ({ fen: "fen", turn: WHITE, clock: null })),
      isActive: false,
      notify: mock(() => {}),
      broadcast: mock(() => {}),
    } as unknown as Game;
    const games: GameStore = {
      get: mock((): Game | null => null),
      findWaiting: mock(() => {
        throw new Error("should not reach matchmaking when create=true");
      }),
      create: mock(() => game),
      commit: mock(() => {}),
      drop: mock(() => {}),
      sweep: mock(() => 0),
      startSweeping: mock(() => {}),
      stopSweeping: mock(() => {}),
    };
    const cmd = new JoinCommand(games);

    const result = await cmd.run(
      { mode: HUMAN_VS_HUMAN, create: true, roomId: "ignored-screening-id" },
      makeOccupant(),
    );

    expect(result).toEqual(ok({ gameId: game.id, color: WHITE }));
    expect(games.get).not.toHaveBeenCalled();
    expect(games.create).toHaveBeenCalledWith(expect.anything(), HUMAN_VS_HUMAN, expect.anything());
    expect(games.findWaiting).not.toHaveBeenCalled();
  });

  it("returns err(ROOM_NOT_FOUND) when an explicit roomId (invite link) doesn't match any game", async () => {
    const games: GameStore = {
      get: mock((): Game | null => null),
      findWaiting: mock(() => {
        throw new Error("should not reach matchmaking when roomId is supplied");
      }),
      create: mock(() => {
        throw new Error("should not create a phantom room for a missing invite");
      }),
      commit: mock(() => {}),
      drop: mock(() => {}),
      sweep: mock(() => 0),
      startSweeping: mock(() => {}),
      stopSweeping: mock(() => {}),
    };
    const cmd = new JoinCommand(games);

    const result = await cmd.run({ mode: HUMAN_VS_HUMAN, roomId: "stale-invite-id" }, makeOccupant());

    expect(result).toEqual(err(ROOM_NOT_FOUND));
    expect(games.get).toHaveBeenCalledWith("stale-invite-id");
  });

  it("propagates game.join error when join fails", async () => {
    const game = {
      id: "room-1",
      nextColor: mock(() => WHITE),
      join: mock(() => err(INVALID_MODE)),
    } as unknown as Game;
    const games: GameStore = {
      get: mock((): Game | null => null),
      findWaiting: mock(() => game),
      create: mock(() => ({}) as Game),
      commit: mock(() => {}),
      drop: mock(() => {}),
      sweep: mock(() => 0),
      startSweeping: mock(() => {}),
      stopSweeping: mock(() => {}),
    };
    const cmd = new JoinCommand(games);

    const result = await cmd.run({ mode: HUMAN_VS_HUMAN }, makeOccupant());

    expect(result).toEqual(err(INVALID_MODE));
  });
});
