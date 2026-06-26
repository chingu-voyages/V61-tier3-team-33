import { useParams } from "react-router-dom";
import { EVENTS } from "../../../backend/Rooms/event";
import { useState } from "react";

export const JoinRoom = ({ socketRef }) => {
  const { roomId: roomIdFromURL } = useParams();
  const [roomIdInput, setRoomIdInput] = useState("");

  const joinRoom = (roomIdToJoin: string) => {
    try {
      if (!socketRef.current) {
        console.log("Socket null");
        return;
      }

      console.log("join room sent from UI");
      console.log(socketRef.current.readyState);

      socketRef.current.send(
        JSON.stringify({
          type: EVENTS.JOIN_ROOM,
          roomId: roomIdToJoin,
        })
      );
    } catch (e) {
      console.error("Error joining room:", e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idToJoin = roomIdInput || roomIdFromURL;
    if (!idToJoin) {
      console.log("No room ID provided");
      return;
    }
    joinRoom(idToJoin);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
        />
        <button type="submit">Join Room</button>
      </form>
    </div>
  );
};
