import type { PieceColor } from "./chess";
import type { Mode } from "./game";

/** Resolved session data passed into every command. Null fields = not in a game. */
export type PlayerContext = {
  playerId: string;
  roomId: string | null;
  color: PieceColor | null;
  mode: Mode | null;
};

/** Narrowed PlayerContext with guaranteed roomId and color. */
export type ActivePlayerContext = PlayerContext & { roomId: string; color: PieceColor };

/** Type-narrowing helpers for PlayerContext. */
export const Context = {
  /** Narrow to an in-game context (roomId + color are non-null). */
  inGame(ctx: PlayerContext): ctx is ActivePlayerContext {
    return ctx.roomId !== null && ctx.color !== null;
  },
};
