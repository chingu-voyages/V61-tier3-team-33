import { createContext } from "react";

export type SocketContextType = {
  socket: WebSocket | null;
  userId: string |null;
  setUserId: React.Dispatch<React.SetStateAction<string | null>>;
};

export const SocketContext =
  createContext<SocketContextType | null>(null);