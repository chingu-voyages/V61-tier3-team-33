import type { PieceColor, Mode, WebSocket } from "../domain/types";

// One connection lifecycle. Plain data — no behavior.
// Created by Sessions.open() on connect, mutated by Sessions.bind() on join,
// marked by Sessions.drop() on disconnect. Replaced with a new ws on resume.
export interface Session {
  // Opaque token for reconnection (stored in localStorage by the client).
  token: string;

  // Who this session belongs to. Assigned by Connections.identify().
  playerId: string;

  // The live WebSocket. Replaced on reconnect (Connections.resume()).
  ws: WebSocket;

  // Which game they're in. Set by GameService.join() via Sessions.bind().
  // null until they join a game.
  roomId: string | null;

  // Their color in the game. Set on join.
  color: PieceColor | null;

  // What mode they joined with. Set on join.
  mode: Mode | null;

  // When they connected (epoch ms).
  connectedAt: number;

  // When they disconnected (epoch ms). Set by Sessions.drop().
  // null while connected. Used by prune() to drop stale sessions.
  disconnectedAt: number | null;
}
