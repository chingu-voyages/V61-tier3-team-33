import { useEffect, useRef, useState } from "react";
import { EVENTS } from '../../backend/Rooms/event'
import { JoinRoom } from "./components/JoinRoom";
type ServerMessage =
  | {
    type: EVENTS.CONNECTED;
    userId: string;
  }
  | {
    type: EVENTS.ROOM_CREATED;
    roomId: string;
  }
  | {
    type: EVENTS.ROOM_JOINED;
    roomId: string;
    players: string[];
    gameStatus: "active" | "waiting" | "over";
  }
  | {
    type: EVENTS.ERROR;
    message: string;
  };

function App() {
  const socketRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [url, setURL] = useState("");

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev]);
  };

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3500/ws");

    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      addLog("Connected to server");
    };

    socket.onmessage = (event) => {
      const data: ServerMessage = JSON.parse(event.data);

      switch (data.type) {
        case EVENTS.CONNECTED:
          setUserId(data.userId);
          break;

        case EVENTS.ROOM_CREATED:
          setRoomId(data.roomId);
          const address = window.location.href;
          setURL(`${address}/join/${data.roomId}`)
          break;

        case EVENTS.ROOM_JOINED:
          console.log(data.players);
          break;

        case EVENTS.ERROR:
          console.log(data.message);
          break;
      }
    };

    socket.onerror = () => {
      addLog("Socket Error");
    };

    socket.onclose = () => {
      setConnected(false);
      addLog("Disconnected");
    };

    return () => {
      socket.close();
    };
  }, []);


  const createRoom = () => {
    console.log("Button clicked");

    if (!socketRef.current) {
      console.log("Socket null");
      return;
    }

    console.log(socketRef.current.readyState);

    socketRef.current.send(
      JSON.stringify({
        type: EVENTS.CREATE_ROOM,
      })
    );

    console.log("Message sent");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "white", padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>♟ Chess Multiplayer</h1>

      <div style={{ padding: "1rem", border: "1px solid #444", borderRadius: "10px", marginTop: "1rem" }}>
        <h3>Connection Status</h3>
        <p>Status: <strong>{connected ? "✅ Connected" : "❌ Disconnected"}</strong></p>
        <p>User ID: {userId || "Waiting..."}</p>
        <p>Room URL: {url || "No Room"}</p>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={createRoom}
          disabled={!connected}
          style={{ padding: "10px 20px", cursor: "pointer" }}
        >
          Create Room
        </button>

        <input
          type="text"
          placeholder="Enter Room ID to join"
          id="joinRoomInput"
          style={{ padding: "10px", background: "#222", color: "white", border: "1px solid #444" }}
        />

      </div>

      <div style={{ marginTop: "2rem", border: "1px solid #444", padding: "1rem", borderRadius: "10px" }}>
        <h3>Logs</h3>
        {logs.length === 0 ? (
          <p>No events yet...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ borderBottom: "1px solid #333", padding: "4px 0" }}>
              {log}
            </div>
          ))
        )}
      </div>
      <JoinRoom socketRef={socketRef}/>
    </div>
  );
}

export default App;