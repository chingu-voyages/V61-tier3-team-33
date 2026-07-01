import { EVENTS } from "../Rooms/event"

export type MoveMessage = {
    type: EVENTS.MOVE;
    roomId: string;
    from: string;
    to: string;
}