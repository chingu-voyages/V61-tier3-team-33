import type {
  JoinInput,
  MoveInput,
  Position,
  WebSocket,
} from "../domain/types";

/** Player-facing actions a client can trigger over a socket. */
export interface GameFacade {
  /** Joins or rejoins a game. */
  join(ws: WebSocket, input: JoinInput): Promise<void>;
  /** Attempts a move for the caller's color. */
  move(ws: WebSocket, input: MoveInput): Promise<void>;
  /** Asks the opponent to undo the last move. */
  requestUndo(ws: WebSocket): Promise<void>;
  /** Accepts the opponent's pending undo request. */
  acceptUndo(ws: WebSocket): Promise<void>;
  /** Declines the opponent's pending undo request. */
  declineUndo(ws: WebSocket): Promise<void>;
  /** Ends the game as a resignation by the caller. */
  resign(ws: WebSocket): Promise<void>;
  /** Leaves the game. */
  leave(ws: WebSocket): Promise<void>;
  /** Resends the caller's current game state. */
  sync(ws: WebSocket): Promise<void>;
  /**
   * The click-a-piece step before move — replies with the legal destination squares, or a rejection reason.
   * @param position — the board square the player clicked
   */
  selectPosition(ws: WebSocket, position: Position): Promise<void>;
}
