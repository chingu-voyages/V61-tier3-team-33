import { EVENTS } from "../Rooms/event"
import type { TimeControl } from "../Rooms/room.type"

export type MoveMessage = {
    type: EVENTS.MOVE;
    roomId: string;
    from: string;
    to: string;
}

export type TimeControlMessageSetup = {
    type: EVENTS.TIME_CONTROL_SETUP;
    roomId: string;
    timeControl: TimeControl;
}

export type SyncClockPayload = {
    type: EVENTS.SYNC_CLOCK;
    roomId: string;
    whiteTimeMs: number | null;
    blackTimeMs: number | null;
}

export type FlagFallPayload = {
    type: EVENTS.FALL_OF_FLAG;
    roomId: string;
    loser: "white" | "black";
}