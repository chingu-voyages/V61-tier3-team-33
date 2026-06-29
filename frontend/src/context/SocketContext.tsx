import {
    createContext,
    useContext,
    useEffect,
    useState
  } from "react";
  
  const SocketContext = createContext<WebSocket | null>(null);
  
  export function SocketProvider({
    children,
  }: {
    children: React.ReactNode;
  }) {
  
    const [socket, setSocket] = useState<WebSocket | null>(null);
  
    useEffect(() => {
  
      const ws = new WebSocket("ws://localhost:3500/ws");
  
      ws.onopen = () => {
        console.log("Connected");
        setSocket(ws);
      };
  
      return () => ws.close();
  
    }, []);
  
    return (
      <SocketContext.Provider value={socket}>
        {children}
      </SocketContext.Provider>
    );
  }
  
  export const useSocket = () => useContext(SocketContext);