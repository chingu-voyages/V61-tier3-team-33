import { Elysia } from 'elysia'
import type { User } from '../Rooms/room.type'
import { EVENTS } from '../Rooms/event';
import { Room } from '../Rooms/roomClass';
import type { MoveMessage } from './server.types';
import { Position, WHITE, BLACK } from "./chess";
import type WebSocket from 'ws';

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
                      break
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
            const id: string = wsData.userId

            users.delete(id)

            for (const room of rooms.values()) {
                if (!room.players.includes(id)) continue

                room.removePlayer(id)

                // Notify everyone still in the room
                const payload = JSON.stringify({
                    type: EVENTS.PLAYER_LEFT,
                    playerId: id,
                    gameStatus: room.gameStatus
                })

                for (const playerId of room.players) {
                    users.get(playerId)?.ws.send(payload)
                }

                if (room.players.length === 0 || room.gameStatus === "over") {
                    rooms.delete(room.id)
                }
            }
        }
      } catch (error) {
        console.error(error)
      }


    },
    close(ws) {

      const id = (ws.data as any).userId;
  
      users.delete(id);
  
      for (const room of rooms.values()) {
  
          if (!room.players.includes(id)) continue;
  
          room.removePlayer(id);
  
          // notify everyone still in the room
          const payload = JSON.stringify({
              type: EVENTS.PLAYER_LEFT,
              playerId: id,
              gameStatus: room.gameStatus
          });
  
          for (const playerId of room.players) {
              users.get(playerId)?.ws.send(payload);
          }
  
          if (room.players.length === 0 || room.gameStatus === "over") {
              rooms.delete(room.id);
          }
      }
  }
  })

  .listen(3500, () => {
    console.log("server starts at 3500")
  })
