// src/pages/GamePage.tsx
import { EVENTS } from "../../../backend/Rooms/event";
import { useState, useEffect } from "react";
import { ChessBoard } from "react-chessboard-ui";
import "react-chessboard-ui/dist/index.css";
import { useSocket } from "../context/useSocket";
import { useParams } from "react-router-dom";
import { coordToSquare } from "../utils/coordinateConvertor";

// ✅ FIX: Make FEN optional to match library's MoveData type
type MoveData = {
  FEN?: string; // Allow undefined to match library type
  from: [number, number];
  to: [number, number];
  figure: {
    color: "white" | "black";
    type:
      | "pawn"
      | "bishop"
      | "knight"
      | "rook"
      | "queen"
      | "king";
  };
};

export default function GamePage() {
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );

  const [turn, setTurn] = useState("white");
  const [myColor, setMyColor] = useState<"white" | "black">("white");
  const { socket, userId } = useSocket();
  const { roomId } = useParams();

  useEffect(() => {
    if (!socket) return;

    const handler = (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      console.log("Received websocket:", data);

      switch (data.type) {
        case EVENTS.ROOM_JOINED:
          console.log(data);
          
          if (userId === data.whitePlayer) {
            setMyColor("white");
          } else {
            setMyColor("black");
          }
          break;

        case EVENTS.CHESS_STATE:
          if (data.turn === 0) {
            setTurn("white");
          } else {
            setTurn("black");
          }
          console.log("Updating board");
          console.log(data.fen);
      
          setFen(data.fen);
          break;
      }
    };

    socket.addEventListener("message", handler);

    return () => socket.removeEventListener("message", handler);
  }, [socket, userId]);

  const handleMove = (move: MoveData) => {
    if (!socket) return;
    
    console.log("My color", myColor);
    console.log("Turn", turn);
    console.log("Piece", move.figure.color);
    
    // Check if the piece belongs to the player
    if (move.figure.color !== myColor) {
      console.log("Wrong piece");
      return;
    }
    
    // Check if it's the player's turn
    if (turn !== myColor) {
      console.log("Wrong turn");
      return;
    }
    
    // Convert coordinates into board notations
    console.log("Sending move");
    const from = coordToSquare(move.from);
    const to = coordToSquare(move.to);

    console.log(from, to);
    
    socket?.send(
      JSON.stringify({
        type: EVENTS.MOVE,
        roomId,
        from,
        to,
      })
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#181818",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "3rem",
        padding: "2rem",
      }}
    >
      {/* Left Side */}
      <div>
        <h2>♟ Multiplayer Chess</h2>
        <p>Turn: {turn}</p>
        <p>You are: {myColor}</p>
      </div>

      {/* Chess Board */}
      <div style={{ width: 650 }}>
        <ChessBoard
          key={fen}
          FEN={fen}
          reversed={myColor === "black"}
          onChange={handleMove}
          onEndGame={(result) => {
            console.log(result);
          }}
        />
      </div>

      {/* Right Side */}
      <div style={{ width: 250 }}>
        <h3>Move History</h3>
        <p>Coming Soon...</p>
        <hr />
        <h3>Game Status</h3>
        <p>Waiting for move...</p>
      </div>
    </div>
  );
}