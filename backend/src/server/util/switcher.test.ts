import { describe, expect, it, mock } from "bun:test";

import type { GameReader } from "../store/game/game-store";
import type { Session } from "../store/session/session";
import type { SessionWriter } from "../store/session/session-store";
import type { JoinInput, PlayerContext, WebSocket } from "../types";
import { HUMAN_VS_HUMAN, WHITE, WS_OPEN } from "../types";
import { RoomSwitcher } from "./switcher";

function makeSocket(id: string): WebSocket {
  return { id, readyState: WS_OPEN, send: mock(() => {}), close: mock(() => {}) } as unknown as WebSocket;
}

function makeGameReader(): GameReader {
  return { get: mock(() => null), findWaiting: mock(() => null) };
}

function makeSessionWriter(): SessionWriter {
  return {
    open: mock(() => null as unknown as Session),
    resume: mock(() => null),
    resumeOrOpen: mock(() => null as unknown as Session),
    drop: mock(() => {}),
    bind: mock(() => {}),
    clearSession: mock(() => {}),
    clearByPlayerId: mock(() => {}),
    reattachSocket: mock(() => null),
    prune: mock(() => {}),
    startPruning: mock(() => {}),
    stopPruning: mock(() => {}),
  };
}

describe("Switcher", () => {
  it("capture returns null when ctx has no room", () => {
    const games = makeGameReader();
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ctx: PlayerContext = { playerId: "p1", roomId: null, color: null, mode: null };
    const input: JoinInput = { mode: HUMAN_VS_HUMAN };
    expect(switcher.capture(ctx, input, makeSocket("p1"))).toBeNull();
  });

  it("capture returns null when joining the same room", () => {
    const games = makeGameReader();
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-1", mode: HUMAN_VS_HUMAN };
    expect(switcher.capture(ctx, input, makeSocket("p1"))).toBeNull();
  });

  it("capture returns SwitchingFrom and clears session when switching rooms and old room exists", () => {
    const games = makeGameReader();
    (games.get as ReturnType<typeof mock>).mockReturnValue({ isFinished: false });
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ws = makeSocket("p1");
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    const result = switcher.capture(ctx, input, ws);
    expect(result).toEqual({ roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
    expect(sessions.clearSession).toHaveBeenCalledWith(ws);
  });

  it("capture returns null when switching to a room that does not exist", () => {
    const games = makeGameReader();
    (games.get as ReturnType<typeof mock>).mockReturnValue(null);
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    expect(switcher.capture(ctx, input, makeSocket("p1"))).toBeNull();
  });

  it("rollback restores session after capture", () => {
    const games = makeGameReader();
    (games.get as ReturnType<typeof mock>).mockReturnValue({ isFinished: false });
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ws = makeSocket("p1");
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    const from = switcher.capture(ctx, input, ws);
    switcher.rollback(from, ws);
    expect(sessions.bind).toHaveBeenCalledWith(ws, { roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
  });

  it("rollback is a no-op with null input", () => {
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(makeGameReader(), sessions);
    switcher.rollback(null, makeSocket("p1"));
    expect(sessions.bind).not.toHaveBeenCalled();
  });

  it("commit leaves old game after capture", () => {
    const games = makeGameReader();
    const leave = mock(() => {});
    (games.get as ReturnType<typeof mock>).mockReturnValue({ isFinished: false, leave });
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ws = makeSocket("p1");
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    const from = switcher.capture(ctx, input, ws);
    switcher.commit(from);
    expect(leave).toHaveBeenCalledWith(WHITE);
  });

  it("commit does not leave finished game", () => {
    const games = makeGameReader();
    const leave = mock(() => {});
    (games.get as ReturnType<typeof mock>).mockReturnValue({ isFinished: true, leave });
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ws = makeSocket("p1");
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    const from = switcher.capture(ctx, input, ws);
    switcher.commit(from);
    expect(leave).not.toHaveBeenCalled();
  });

  it("commit skips leave when game no longer exists in the store", () => {
    const games = makeGameReader();
    const gamesGet = mock(() => null);
    games.get = gamesGet;
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ws = makeSocket("p1");
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    const from = switcher.capture(ctx, input, ws);
    expect(() => switcher.commit(from)).not.toThrow();
    expect(gamesGet).toHaveBeenCalledWith("room-1");
  });

  it("commit is a no-op with null input", () => {
    const games = makeGameReader();
    const gamesGet = mock(() => null);
    games.get = gamesGet;
    const switcher = new RoomSwitcher(games, makeSessionWriter());
    switcher.commit(null);
    expect(gamesGet).not.toHaveBeenCalled();
  });

  it("capture returns null when input has no roomId", () => {
    const games = makeGameReader();
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { mode: HUMAN_VS_HUMAN };
    expect(switcher.capture(ctx, input, makeSocket("p1"))).toBeNull();
  });

  it("capture includes mode in switching from", () => {
    const games = makeGameReader();
    (games.get as ReturnType<typeof mock>).mockReturnValue({ isFinished: false });
    const sessions = makeSessionWriter();
    const switcher = new RoomSwitcher(games, sessions);
    const ws = makeSocket("p1");
    const ctx: PlayerContext = { playerId: "p1", roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN };
    const input: JoinInput = { roomId: "room-2", mode: HUMAN_VS_HUMAN };
    const from = switcher.capture(ctx, input, ws);
    expect(from).toEqual({ roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
    switcher.rollback(from, ws);
    expect(sessions.bind).toHaveBeenCalledWith(ws, { roomId: "room-1", color: WHITE, mode: HUMAN_VS_HUMAN });
  });
});
