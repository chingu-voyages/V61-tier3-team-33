import { describe, test, expect } from "bun:test";
import WebSocket from "ws";
import { EVENTS } from "../Rooms/event";

const URL = "ws://localhost:3500/ws";

function waitForMessage(ws: WebSocket): Promise<any> {
    return new Promise((resolve) => {
        ws.once("message", (raw) => {
            resolve(JSON.parse(raw.toString()));
        });
    });
}

function send(ws: WebSocket, payload: object) {
    ws.send(JSON.stringify(payload));
}

describe("Chess WebSocket Integration", () => {
    test("complete multiplayer game flow", async () => {

        const player1 = new WebSocket(URL);
        const player2 = new WebSocket(URL);

        await Promise.all([
            new Promise(res => player1.once("open", res)),
            new Promise(res => player2.once("open", res)),
        ]);

        /* ---------------- CONNECTED ---------------- */

        const connected1 = await waitForMessage(player1);
        const connected2 = await waitForMessage(player2);

        expect(connected1.type).toBe(EVENTS.CONNECTED);
        expect(connected2.type).toBe(EVENTS.CONNECTED);

        /* ---------------- CREATE ROOM ---------------- */

        send(player1, {
            type: EVENTS.CREATE_ROOM
        });

        const roomCreated = await waitForMessage(player1);

        expect(roomCreated.type).toBe(EVENTS.ROOM_CREATED);

        const roomId = roomCreated.roomId;

        expect(roomId).toBeString();

        /* ---------------- JOIN ROOM ---------------- */

        send(player2, {
            type: EVENTS.JOIN_ROOM,
            roomId
        });

        const joined1 = await waitForMessage(player1);
        const joined2 = await waitForMessage(player2);

        expect(joined1.type).toBe(EVENTS.ROOM_JOINED);
        expect(joined2.type).toBe(EVENTS.ROOM_JOINED);

        expect(joined1.players.length).toBe(2);
        expect(joined2.players.length).toBe(2);

        /* ---------------- WHITE MOVE ---------------- */

        send(player1, {
            type: EVENTS.MOVE,
            roomId,
            from: "e2",
            to: "e4"
        });

        const state1 = await waitForMessage(player1);
        const state2 = await waitForMessage(player2);

        expect(state1.type).toBe(EVENTS.CHESS_STATE);
        expect(state2.type).toBe(EVENTS.CHESS_STATE);

        expect(state1.turn).toBe(1);

        /* ---------------- BLACK MOVE ---------------- */

        send(player2, {
            type: EVENTS.MOVE,
            roomId,
            from: "e7",
            to: "e5"
        });

        const state3 = await waitForMessage(player1);
        const state4 = await waitForMessage(player2);

        expect(state3.type).toBe(EVENTS.CHESS_STATE);
        expect(state4.type).toBe(EVENTS.CHESS_STATE);

        expect(state3.turn).toBe(0);

        /* ---------------- REQUEST CURRENT STATE ---------------- */

        send(player1, {
            type: EVENTS.CHESS_STATE,
            roomId
        });

        const current = await waitForMessage(player1);

        expect(current.type).toBe(EVENTS.CHESS_STATE);
        expect(current.roomId).toBe(roomId);

        /* ---------------- DISCONNECT ---------------- */

        player2.close();

        const left = await waitForMessage(player1);

        expect(left.type).toBe(EVENTS.PLAYER_LEFT);

        expect(left.playerId).toBe(connected2.userId);

        player1.close();
    });
});
