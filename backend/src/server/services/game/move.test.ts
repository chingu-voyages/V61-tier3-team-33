import { describe, expect, it, mock } from "bun:test";

import { Notifications } from "../../protocol/events";
import type { Game } from "../../store/game/game";
import type { GameReader } from "../../store/game/game-store";
import type { GameSnapshot, Move, MoveInput, PlayerContext } from "../../types";
import { err, HUMAN_VS_HUMAN, NOT_YOUR_TURN, ok, Position, WHITE } from "../../types";
import { MoveCommand } from "./move";

function makeMoveInput(overrides: Partial<MoveInput> = {}): MoveInput {
  return { from: Position(0), to: Position(1), ...overrides };
}

describe("MoveCommand", () => {
  it("broadcasts moveMade and returns ok with move on success", async () => {
    const broadcast = mock(() => {});
    const snapshot = { fen: "new-fen" } as GameSnapshot;
    const move = { from: Position(0), to: Position(1) } as Move;
    const game = {
      move: mock(() => Promise.resolve(ok(move))),
      snapshot: mock(() => snapshot),
      isFinished: false,
      id: "room-1",
      broadcast,
    } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new MoveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input = makeMoveInput();

    const result = await cmd.run(ctx, input);

    expect(result).toEqual(ok({ move, finished: false }));
    expect(broadcast).toHaveBeenCalledWith(Notifications.moveMade("room-1", WHITE, move, snapshot));
  });

  it("flags finished true when game ended after move", async () => {
    const broadcast = mock(() => {});
    const snapshot = { fen: "checkmate" } as GameSnapshot;
    const move = { from: Position(0), to: Position(1) } as Move;
    const game = {
      move: mock(() => Promise.resolve(ok(move))),
      snapshot: mock(() => snapshot),
      isFinished: true,
      id: "room-1",
      broadcast,
    } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new MoveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };

    const result = await cmd.run(ctx, makeMoveInput());

    expect(result).toEqual(ok({ move, finished: true }));
  });

  it("notifies player and returns err(NOT_YOUR_TURN) when move rejected", async () => {
    const notify = mock(() => {});
    const game = {
      move: mock(() => Promise.resolve(err(NOT_YOUR_TURN))),
      id: "room-1",
      notify,
    } as unknown as Game;
    const games: GameReader = { get: mock((): Game => game), findWaiting: mock(() => null) };
    const cmd = new MoveCommand(games);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input = makeMoveInput({ from: Position(3), to: Position(4) });

    const result = await cmd.run(ctx, input);

    expect(result).toEqual(err(NOT_YOUR_TURN));
    expect(notify).toHaveBeenCalledWith(
      WHITE,
      Notifications.moveRejected("room-1", WHITE, NOT_YOUR_TURN, Position(3), Position(4)),
    );
  });
});
