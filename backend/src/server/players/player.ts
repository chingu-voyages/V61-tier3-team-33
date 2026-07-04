import type { PieceColor } from "../../chess"

export type AuthProvider = "password" | "google" | "guest"
export type PlayerRole = "guest" | "member"
export type GameOutcome = "win" | "loss" | "draw"

export interface GameMeta {
    gameId: string,
    results: GameOutcome,
    playedAt: number,
    color: PieceColor
}

export interface Player {
    readonly id: string,
    username: string,
    readonly createdAt: number,
    readonly role: PlayerRole,
    results: GameMeta[]// game id and result
    readonly authProvider: AuthProvider
}


function createHexId(length: number) {
    const hexID = [...crypto.getRandomValues(new Uint8Array(length))].map(m => ('0' + m.toString(16)).slice(-2)).join("");
    return hexID
}

/**
 * C1: id matches "p_" + 8 hex chars
 * C2: Guest username matches "Guest-" + 4 hex chars
 * C3: results: [], createdAt within 1s of Date.now()
 * C4: authProvider: "guest", role: "guest"
 */
export function createGuestPlayer(): Player {
    const guestId = `p_${createHexId(4)}`;
    const Guestname = `Guest-${createHexId(2)}`

    return {
        id: guestId,
        username: Guestname,
        createdAt: Date.now(),
        role: "guest",
        results: [],
        authProvider: 'guest'
    }
}
/**
 * C1: id matches "p_" + 8 hex chars
 * C2: Stores the given username exactly
 * C3: results: [], createdAt within 1s of Date.now()
 * C4: provider set to password/google, role: "member"
 */
export function createPlayer(username: string, provider: AuthProvider): Player {
    const playerId = `p_${createHexId(4)}`;

    return {
        id: playerId,
        username: username,
        createdAt: Date.now(),
        role: "member",
        results: [],
        authProvider: provider
    }
}