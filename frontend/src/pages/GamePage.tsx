// src/pages/GamePage.tsx
import { EVENTS } from "../../../backend/Rooms/event";
import { useState,useEffect } from "react";
import { ChessBoard } from "react-chessboard-ui";
import "react-chessboard-ui/dist/index.css";
import { useSocket } from "../context/SocketContext";
import { useParams } from "react-router-dom";
import { coordToSquare } from "../utils/coordinateConvertor";
type MoveData = {
  FEN: string;
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

  const [myColor] = useState<"white" | "black">("white");

  const socket = useSocket();

const { roomId } = useParams();

useEffect(() => {

    if (!socket) return;

    const handler = (e: MessageEvent) => {

        const data = JSON.parse(e.data);

        switch(data.type){

            case EVENTS.ROOM_JOINED:
              console.log(data);
                setFen(data.fen);

                setTurn(data.turn);

                break;

            case EVENTS.CHESS_STATE:

                setFen(data.fen);

                setTurn(data.turn);

                break;
        }

    };

    socket.addEventListener("message", handler);

    return () => socket.removeEventListener("message", handler);

}, [socket]);
const handleMove = (move: MoveData) => {
  const from = coordToSquare(move.from);

  const to = coordToSquare(move.to);

  console.log(from, to);
  socket?.send(JSON.stringify({

      type: EVENTS.MOVE,

      roomId,

      from,

      to

  }));

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

        <p>Turn : {turn}</p>

        <p>You are : {myColor}</p>
      </div>

      {/* Chess Board */}
      <div style={{ width: 650 }}>
        <ChessBoard
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