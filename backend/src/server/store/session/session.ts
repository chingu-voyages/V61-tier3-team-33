import type { Mode, PieceColor, WebSocket } from "../../types";

/** Connection lifecycle — plain data, no behavior. */
export interface Session {
  /** Resume token stored in localStorage. */
  token: string;

  /** Assigned by Connections.identify(). */
  playerId: string;

  /** Live WebSocket (replaced on resume). */
  ws: WebSocket;

  /** Bound game id — null until the player joins a room. */
  roomId: string | null;

  /** Color assigned on join. */
  color: PieceColor | null;

  /** Mode assigned on join. */
  mode: Mode | null;

  /** Epoch ms when the session was first opened. */
  connectedAt: number;

  /** Epoch ms when the session was last dropped — null while connected. */
  disconnectedAt: number | null;
}

/** Null-safe type guards for Session. */
export const Session = {
  exists(s: Session | null | undefined): s is Session {
    return s !== null && s !== undefined;
  },

  isConnected(s: Session | null | undefined): s is Session {
    return !!s && s.disconnectedAt === null;
  },

  isDisconnected(s: Session | null | undefined): s is Session {
    return !!s && s.disconnectedAt !== null;
  },

  inRoom(s: Session | null | undefined): s is Session & { roomId: string; color: PieceColor } {
    return !!s && s.roomId !== null && s.color !== null;
  },
};
