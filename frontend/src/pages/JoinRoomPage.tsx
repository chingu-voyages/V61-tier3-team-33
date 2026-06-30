import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { EVENTS } from "../../../backend/Rooms/event";
import { useNavigate, useParams } from "react-router-dom";

export default function JoinRoomPage() {

    const {socket,userId} = useSocket();

    const navigate = useNavigate();

    const params = useParams();

    const [room, setRoom] = useState(params.roomId ?? "");

    useEffect(() => {

        if (!socket) return;
    
        const handler = (e: MessageEvent) => {
    
            const data = JSON.parse(e.data);
    
            if(data.type === EVENTS.ROOM_JOINED){
    
                navigate(`/game/${data.roomId}`);
    
            }
    
        };
    
        socket.addEventListener("message", handler);
    
        return () => socket.removeEventListener("message", handler);
    
    }, [socket]);

    return (

        <div>

            <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
            />

            <button
                onClick={() => {

                    socket?.send(JSON.stringify({

                        type: EVENTS.JOIN_ROOM,

                        roomId: room

                    }));

                }}
            >

                Join

            </button>

        </div>

    );

}