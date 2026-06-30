import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { EVENTS } from "../../../backend/Rooms/event";

export default function WaitingRoomPage() {

    const { roomId } = useParams();

    const {socket,userId} = useSocket();

    const navigate = useNavigate();

    useEffect(() => {

        if (!socket) return;

        const handler = (e: MessageEvent) => {

            const data = JSON.parse(e.data);

            if (data.type === EVENTS.ROOM_JOINED) {

                navigate(`/game/${data.roomId}`);

            }

        };

        socket.addEventListener("message", handler);

        return () => {

            socket.removeEventListener("message", handler);

        };

    }, [socket]);

    return (

        <div>

            <h1>Waiting for another player...</h1>

            <p>Room ID: {roomId}</p>

        </div>

    );

}