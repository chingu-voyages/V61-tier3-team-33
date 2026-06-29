import { Elysia } from 'elysia'
import type { User } from '../Rooms/room.type'
import { EVENTS } from '../Rooms/event';
import { Room } from '../Rooms/roomClass';
import type { MoveMessage } from './server.types';
import { Position } from './chess';
const users = new Map<string, User>()
const rooms = new Map<string, Room>();

new Elysia()

  .ws('/ws', {


    open(ws) {
      console.log("connection has opened")

      const id = crypto.randomUUID();

      (ws.data as any).userId = id

      //map key (id 1st) and 2nd is userId
      users.set(id, {
        id, ws
      })
      ws.send(JSON.stringify({
        type: EVENTS.CONNECTED,
        userId: id
      }))

      console.log(id)
    }
    ,
    message(ws, rawdata: any) {
      console.log("this is message handler")
      try {

        const data = rawdata as {
          type: string;
          roomId?: string
        };

        switch (data.type) {

          case EVENTS.CONNECTED:
            break
          case EVENTS.CREATE_ROOM:
            const roomId: string = crypto.randomUUID();
            const creatorId = (ws.data as any).userId;
            const room = new Room(roomId, creatorId);
            room.gameStatus = 'waiting';
            rooms.set(roomId, room);
            
            console.log(roomId)

            ws.send(JSON.stringify({
              type: EVENTS.ROOM_CREATED,
              roomId,
              inviteLink: `http://localhost:5173/join/${roomId}`
          }));
            break
          case EVENTS.JOIN_ROOM:
            const roomIdtoJoin = data.roomId;
            const joinedID = (ws.data as any).userId;
            if (!roomIdtoJoin) {
              console.error("roomId is not available")
              ws.send(JSON.stringify({ type: "ERROR", message: "No room ID provided" }));
              break;

            }
            const targetRoom = rooms.get(roomIdtoJoin);
            if (!targetRoom) {
              console.error("Room doesnt exist")
              ws.send(JSON.stringify({ type: "ERROR", message: "No room exists" }));
              break;
            }

            if (targetRoom.gameStatus !== 'waiting') {
              ws.send(JSON.stringify({
                type: "ERROR",
                message: "The game is already active"
              }))

            }
            if (targetRoom.isFull()) {
              ws.send(JSON.stringify({
                type: "ERROR",
                message: "The room is full"
              }))

              return;
            }

            const added = targetRoom.addPlayer(joinedID);
            targetRoom.gameStatus = "active";

            if (!added) {
              ws.send(
                JSON.stringify({
                  type: EVENTS.ERROR,
                  message: "Unable to join room"
                })
              );

              break;
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
            });
            for (const playerId of targetRoom.players) {
              const player = users.get(playerId);

              if (player) {
                player.ws.send(joinPayload);
              }
            }


            break
          case EVENTS.MOVE: {
            const message = data as MoveMessage
            const targetRoom = rooms.get(message.roomId);
            if (!targetRoom) {
              ws.send(JSON.stringify({
                type: EVENTS.ERROR,
                message: "room cant be found"
              }))
              break;
            }
            //parsing the move from the message
            const from = Position.parse(message.from)
            const to = Position.parse(message.to)

            if (from === null || to === null) {
              ws.send(JSON.stringify({
                type: EVENTS.ERROR,
                message: "Invalid squares"
              }));
              break;
            }
            //validating the move
            if (!targetRoom.chess.isLegalMove(message.from, message.to)) {
              ws.send(JSON.stringify({
                type: EVENTS.ERROR,
                message: "Illegal move"
              }));
              break;
            }
            try {
              //making the move
              targetRoom.chess.moveTo(from, to);
            } catch {
              ws.send(JSON.stringify({
                type: EVENTS.ERROR,
                message: "Illegal move"
              }));
              break;
            }
            //sending the result from the chess engine to the UI
            const payload = JSON.stringify({
              type: EVENTS.CHESS_STATE,
              fen: targetRoom.chess.toFen(),
              turn: targetRoom.chess.sideToMove(),
              inCheck: targetRoom.chess.isInCheck(),
              isOver: targetRoom.chess.isOver(),
              result: targetRoom.chess.gameResult()
          });
            //boardcasting the result to players in the room
            for (const id of targetRoom.players) {
              users.get(id)?.ws.send(payload);
            }
          }


            break
          case EVENTS.CHESS_FEN:
            break
         
            break
          case EVENTS.PLAYER_LEFT:
            break
          case EVENTS.CHESS_STATE:
            break
        }



      } catch (error) {
        console.error(error)
      }


    },
    close(ws) {

      const id = (ws.data as any).userId;
  
      users.delete(id);
  
      for (const room of rooms.values()) {
  
          room.removePlayer(id);
  
          if (room.players.length === 0) {
              rooms.delete(room.id);
          }
  
      }
  
  }

  })

  .listen(3500, () => {
    console.log("server starts at 3500")
  })
