import { Elysia } from 'elysia'
import type { User } from '../Rooms/room.type'
import { EVENTS } from '../Rooms/event';
import { Room } from '../Rooms/roomClass';
import type { MoveMessage } from './server.types';
import { Position, WHITE } from "./chess";
import type { TimeControlMessageSetup } from "./server.types";

// Define proper types
interface WebSocketData {
    userId: string;
}

interface JoinRoomData {
    type: string;
    roomId: string;
}

interface ChessStateRequest {
    type: string;
    roomId: string;
}

const users = new Map<string, User>()
const rooms = new Map<string, Room>()
const abandonTimers = new Map<string, ReturnType<typeof setTimeout>>()

const ABANDON_TIMEOUT_MS = 5 * 60 * 1000

function startAbandonTimer(roomId: string): void {
    const existing = abandonTimers.get(roomId)
    if (existing) clearTimeout(existing)

    const room = rooms.get(roomId)
    const tc = room?.timeControl
    let timeoutMs = ABANDON_TIMEOUT_MS
    if (tc?.mode === "per_move") {
        timeoutMs = (tc.minutes * 60 + tc.seconds) * 1000 + (tc.ms ?? 0)
    }

    const timer = setTimeout(() => {
        const room = rooms.get(roomId)
        if (!room || room.gameStatus !== "active") return

        const loser = room.chess.sideToMove() === WHITE ? "white" : "black"
        room.gameStatus = "over"

        const payload = JSON.stringify({
            type: EVENTS.AUTO_RESIGNED,
            roomId,
            loser
        })

        for (const id of room.players) {
            users.get(id)?.ws.send(payload)
        }

        abandonTimers.delete(roomId)
    }, timeoutMs)

    abandonTimers.set(roomId, timer)
}

function clearAbandonTimer(roomId: string): void {
    const existing = abandonTimers.get(roomId)
    if (existing) {
        clearTimeout(existing)
        abandonTimers.delete(roomId)
    }
}

function buildChessState(room: Room): string {
    return JSON.stringify({
        type: EVENTS.CHESS_STATE,
        roomId: room.id,
        fen: room.chess.toFen(),
        turn: room.chess.sideToMove(),
        inCheck: room.chess.isInCheck(),
        isOver: room.chess.isOver(),
        result: room.chess.gameResult(),
        players: room.players,
        whitePlayer: room.whitePlayer,
        blackPlayer: room.blackPlayer,
        gameStatus: room.gameStatus,
        whitePlayerTimeMs: room.whitePlayerTimeMs,
        blackPlayerTimeMs: room.blackPlayerTimeMs,
    })
}

// Create the app but don't start it yet
export const app = new Elysia()
    .ws('/ws', {
        open(ws: any) {
            console.log("connection has opened")

            const id = crypto.randomUUID()
            const userId = id

            // Type assertion with proper typing
            const wsData = ws.data as WebSocketData
            wsData.userId = userId

            users.set(id, {
                id,
                ws
            })

            ws.send(JSON.stringify({
                type: EVENTS.CONNECTED,
                userId: id
            }))

            console.log(id)
        },

        message(ws: any, rawdata: unknown) {
            console.log("this is message handler")
            try {
                console.log(rawdata)
                
                // Properly type the raw data parsing
                const data: any = typeof rawdata === "string"
                    ? JSON.parse(rawdata)
                    : rawdata
                    
                console.log("EVENT:", data.type)

                switch (data.type) {
                    case EVENTS.CONNECTED:
                        break

                    case EVENTS.CREATE_ROOM: {
                        const roomId: string = crypto.randomUUID()
                        const wsData = ws.data as WebSocketData
                        const creatorId: string = wsData.userId
                        const room = new Room(roomId, creatorId)
                        room.gameStatus = 'waiting'
                        rooms.set(roomId, room)

                        console.log(roomId)

                        ws.send(JSON.stringify({
                            type: EVENTS.ROOM_CREATED,
                            roomId,
                            inviteLink: `http://localhost:5173/join/${roomId}`
                        }))
                        break
                    }

                    case EVENTS.JOIN_ROOM: {
                        const joinData = data as JoinRoomData
                        const roomIdtoJoin: string = joinData.roomId
                        const wsData = ws.data as WebSocketData
                        const joinedID: string = wsData.userId

                        if (!roomIdtoJoin) {
                            console.error("roomId is not available")
                            ws.send(JSON.stringify({ 
                                type: "ERROR", 
                                message: "No room ID provided" 
                            }))
                            break
                        }

                        const targetRoom = rooms.get(roomIdtoJoin)
                        if (!targetRoom) {
                            console.error("Room doesnt exist")
                            ws.send(JSON.stringify({ 
                                type: "ERROR", 
                                message: "No room exists" 
                            }))
                            break
                        }

                        if (targetRoom.gameStatus !== 'waiting') {
                            ws.send(JSON.stringify({
                                type: "ERROR",
                                message: "The game is already active"
                            }))
                            break
                        }

                        if (targetRoom.isFull()) {
                            ws.send(JSON.stringify({
                                type: "ERROR",
                                message: "The room is full"
                            }))
                            break
                        }

                        const added = targetRoom.addPlayer(joinedID)
                        targetRoom.gameStatus = "active"

                        targetRoom.startClock()
                        startAbandonTimer(roomIdtoJoin)

                        if (!added) {
                            ws.send(JSON.stringify({
                                type: EVENTS.ERROR,
                                message: "Unable to join room"
                            }))
                            break
                        }

                        const joinPayload = JSON.stringify({
                            type: EVENTS.ROOM_JOINED,
                            roomId: targetRoom.id,
                            players: targetRoom.players,
                            whitePlayer: targetRoom.whitePlayer,
                            blackPlayer: targetRoom.blackPlayer,
                            gameStatus: targetRoom.gameStatus,
                            fen: targetRoom.chess.toFen(),
                            turn: targetRoom.chess.sideToMove()
                        })

                        for (const playerId of targetRoom.players) {
                            const player = users.get(playerId)
                            if (player) {
                                player.ws.send(joinPayload)
                            }
                        }
                        break
                    }

                    case EVENTS.MOVE: {
                      console.log("----- MOVE START -----")
                      const message = data as MoveMessage
                      const targetRoom = rooms.get(message.roomId)
                  
                      if (!targetRoom) {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "room cant be found"
                          }))
                          break
                      }
                  
                      if (targetRoom.gameStatus !== "active") {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "Game is not active"
                          }))
                          break
                      }
                  
                      const wsData = ws.data as WebSocketData
                      const sender: string = wsData.userId
                  
                      if (!targetRoom.players.includes(sender)) {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "You are not a player in this room"
                          }))
                          break
                      }
                  
                      console.log("Room found")
                      console.log("Sender:", sender)
                      console.log("White :", targetRoom.whitePlayer)
                      console.log("Black :", targetRoom.blackPlayer)
                      console.log("Turn  :", targetRoom.chess.sideToMove())
                  
                      // ✅ FIX 1: Check turn FIRST before parsing or validating the move
                      const currentPlayer = targetRoom.chess.sideToMove() === WHITE
                          ? targetRoom.whitePlayer
                          : targetRoom.blackPlayer
                  
                      if (sender !== currentPlayer) {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "Not your turn"
                          }))
                          break
                      }
                  
                      const mover: "white" | "black" = sender === targetRoom.whitePlayer ? "white" : "black";
                      const clockResult = targetRoom.onMoveMade(mover);

                      if (clockResult.flagFall) {
                        targetRoom.gameStatus = "over";
                        clearAbandonTimer(targetRoom.id);
                        const flagPayload = JSON.stringify({
                            type: EVENTS.FALL_OF_FLAG,
                            roomId: targetRoom.id,
                            loser: clockResult.loser
                        });
                        for (const id of targetRoom.players) {
                            users.get(id)?.ws.send(flagPayload);
                        }
                        break;
                      }

                      // Parse the move
                      const from = Position.parse(message.from)
                      const to = Position.parse(message.to)
                      console.log("Parsed", from, to)
                  
                      if (from === null || to === null) {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "Invalid squares"
                          }))
                          break
                      }
                  
                      const legal = targetRoom.chess.isLegalMove(message.from, message.to)
                      console.log("Legal =", legal)
                  
                      if (!legal) {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "Illegal move"
                          }))
                          break
                      }
                  
                      try {
                          // Make the move
                          console.log("Calling moveTo")
                          targetRoom.chess.moveTo(from, to)
                  
                          if (targetRoom.chess.isOver()) {
                              targetRoom.gameStatus = "over"
                          }
                      } catch {
                          ws.send(JSON.stringify({
                              type: EVENTS.ERROR,
                              message: "Illegal move"
                          }))
                          break
                      }
                  
                      console.log("Creating payload")
                      const payload = buildChessState(targetRoom)
                  
                      // Broadcast the result to players in the room
                      for (const id of targetRoom.players) {
                          console.log("Sending to", id)
                          users.get(id)?.ws.send(payload)
                      }

                      if (targetRoom.gameStatus === "over") {
                          clearAbandonTimer(targetRoom.id)
                      } else {
                          startAbandonTimer(targetRoom.id)
                      }
                      break
                    }

                    case EVENTS.TIME_CONTROL_SETUP: {
                        const msg = data as TimeControlMessageSetup
                        const room = rooms.get(msg.roomId)

                        if (!room) {
                            ws.send(JSON.stringify({ type: EVENTS.ERROR, message: "Room not found" }))
                            break;
                        }

                        if (room.gameStatus !== "waiting") {
                            ws.send(JSON.stringify({ type: EVENTS.ERROR, message: "Cannot change time control once the game has begun" }))
                            break;
                        }

                        room.setTimeControl(msg.timeControl)
                        ws.send(JSON.stringify({ type: EVENTS.TIME_CONTROL_SETUP, roomId: room.id, timeControl: msg.timeControl }));
                        break;
                    }


                    case EVENTS.CHESS_STATE: {
                        const stateRequest = data as ChessStateRequest
                        const room = rooms.get(stateRequest.roomId)

                        if (!room) {
                            ws.send(JSON.stringify({
                                type: EVENTS.ERROR,
                                message: "Room not found"
                            }))
                            break
                        }

                        ws.send(buildChessState(room))
                        break
                    }
                }
            } catch (error) {
                console.error(error)
            }
        },

      

    close(ws: any) {
        const wsData = ws.data as WebSocketData
        const id = wsData.userId

        users.delete(id)

        for (const room of rooms.values()) {
            if (!room.players.includes(id)) continue

            room.removePlayer(id)

            const payload = JSON.stringify({
                type: EVENTS.PLAYER_LEFT,
                playerId: id,
                gameStatus: room.gameStatus
            })

            for (const playerId of room.players) {
                users.get(playerId)?.ws.send(payload)
            }

            if (room.players.length === 0 || room.gameStatus === "over") {
                clearAbandonTimer(room.id)
                rooms.delete(room.id)
            }
        }
    }
})

app.listen(3500, () => {
console.log("server starts at 3500")
})

export { users, rooms }
