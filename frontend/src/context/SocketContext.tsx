import {
  createContext,
  useEffect,
  useState,
} from "react";
import { EVENTS } from "../../../backend/Rooms/event";

type SocketContextType = {
  socket: WebSocket | null;
  userId: string | null;
  setUserId: React.Dispatch<React.SetStateAction<string | null>>;
};

export const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3500/ws");

    ws.onopen = () => {
      console.log("Connected");
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case EVENTS.CONNECTED:
          setUserId(data.userId);
          break;
      }
    };

    return () => ws.close();
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        userId,
        setUserId,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}