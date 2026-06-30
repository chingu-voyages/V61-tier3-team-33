import { useEffect, useState } from "react";
import { useSocket } from "../context/useSocket";
import { EVENTS } from "../../../backend/Rooms/event";
import { useNavigate } from "react-router-dom";

export default function CreateRoomPage() {
    const { socket } = useSocket();
    const navigate = useNavigate();

    const [roomId, setRoomId] = useState("");
    const [inviteLink, setInviteLink] = useState("");

    useEffect(() => {
        if (!socket) return;

        // ✅ FIX: Use addEventListener instead of assigning socket.onmessage
        const handleMessage = (e: MessageEvent) => {
            const data = JSON.parse(e.data);

            switch (data.type) {
                case EVENTS.ROOM_CREATED:
                    setRoomId(data.roomId);
                    setInviteLink(data.inviteLink);
                    break;

                case EVENTS.ROOM_JOINED:
                    navigate(`/game/${data.roomId}`);
                    break;

                default:
                    break;
            }
        };

        // Use addEventListener rather than assigning socket.onmessage
        socket.addEventListener("message", handleMessage);

        // ✅ Cleanup to avoid duplicate handlers on re-render / socket change
        return () => {
            socket.removeEventListener("message", handleMessage);
        };
    }, [socket, navigate]);

    console.log(roomId);

    const create = () => {
        socket?.send(
            JSON.stringify({
                type: EVENTS.CREATE_ROOM,
            })
        );
    };

    return (
        <div>
            <h2>Create Room</h2>

            <button onClick={create}>Create Room</button>

            {roomId && (
                <>
                    <p>Room ID:</p>
                    <code>{roomId}</code>

                    <p>Invite Link:</p>
                    <input readOnly value={inviteLink} />

                    <button onClick={() => navigator.clipboard.writeText(inviteLink)}>
                        Copy Link
                    </button>

                    <button onClick={() => navigate(`/waiting/${roomId}`)}>
                        Go to Waiting Room
                    </button>
                </>
            )}
        </div>
    );
}