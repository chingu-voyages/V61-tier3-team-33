import { useEffect, useState } from "react";
import { EVENTS } from "../../../backend/Rooms/event";
import { SocketContext } from "./SocketContext";

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
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === EVENTS.CONNECTED) {
        setUserId(data.userId);
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