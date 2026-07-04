"use client"

import { useEffect, useRef, useState } from "react"
import type { TimeControl } from "@/types/clock"

const WS_URL = "ws://localhost:3500/ws"

export type GameOver =
    | { reason: "flag"; loser: "white" | "black" }
    | { reason: "abandoned"; loser: "white" | "black" }

export function useGameSocket() {
    const ws = useRef<WebSocket | null>(null)

    const [userId, setUserId]         = useState<string | null>(null)
    const [roomId, setRoomId]         = useState<string | null>(null)
    const [gameStatus, setGameStatus] = useState<"waiting" | "active" | "over" | null>(null)
    const [turn, setTurn]             = useState<number | null>(null)
    const [whiteMs, setWhiteMs]       = useState<number | null>(null)
    const [blackMs, setBlackMs]       = useState<number | null>(null)
    const [gameOver, setGameOver]     = useState<GameOver | null>(null)
    const [whitePlayer, setWhitePlayer] = useState<string | null>(null)
    const [blackPlayer, setBlackPlayer] = useState<string | null>(null)

    useEffect(() => {
        const socket = new WebSocket(WS_URL)
        ws.current = socket

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data)

            switch (msg.type) {
                case "CONNECTED":
                    setUserId(msg.userId)
                    break

                case "ROOM_CREATED":
                    setRoomId(msg.roomId)
                    setGameStatus("waiting")
                    break

                case "ROOM_JOINED":
                    setRoomId(msg.roomId)
                    setGameStatus(msg.gameStatus)
                    setTurn(msg.turn)
                    setWhitePlayer(msg.whitePlayer)
                    setBlackPlayer(msg.blackPlayer)
                    break

                case "CHESS_STATE":
                    setGameStatus(msg.gameStatus)
                    setTurn(msg.turn)
                    setWhiteMs(msg.whitePlayerTimeMs)
                    setBlackMs(msg.blackPlayerTimeMs)
                    setWhitePlayer(msg.whitePlayer)
                    setBlackPlayer(msg.blackPlayer)
                    break

                case "FALL_OF_FLAG":
                    setGameStatus("over")
                    setGameOver({ reason: "flag", loser: msg.loser })
                    break

                case "AUTO_RESIGNED":
                    setGameStatus("over")
                    setGameOver({ reason: "abandoned", loser: msg.loser })
                    break
            }
        }

        return () => socket.close()
    }, [])

    function send(data: object) {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(data))
        }
    }

    function createRoom() {
        send({ type: "CREATE_ROOM" })
    }

    function joinRoom(id: string) {
        send({ type: "JOIN_ROOM", roomId: id })
    }

    function setupTimeControl(tc: TimeControl) {
        if (!roomId) return
        send({ type: "TIME_CONTROL_SETUP", roomId, timeControl: tc })
    }

    function makeMove(from: string, to: string) {
        if (!roomId) return
        send({ type: "MOVE", roomId, from, to })
    }

    const myColor = userId === whitePlayer ? "white" : userId === blackPlayer ? "black" : null

    return {
        userId, roomId, gameStatus, turn,
        whiteMs, blackMs, gameOver, myColor,
        createRoom, joinRoom, setupTimeControl, makeMove,
    }
}
