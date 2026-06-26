import { Elysia } from 'elysia'
import type {  User } from '../Rooms/room.type'
import { EVENTS } from '../Rooms/event';
import { Room } from '../Rooms/roomClass';

const users = new Map<string, User>()
const rooms=new Map<string,Room>();

new Elysia()

.ws('/ws', {


  open(ws) {
    console.log("connection has opened")

    const id = crypto.randomUUID();

    (ws.data as any).userId = id

    //map key (id 1st) and 2nd is userId
    users.set(id,{
      id,ws
    })
    ws.send(JSON.stringify({
      type: EVENTS.CONNECTED,
      userId: id
    }))

    console.log(id)
  }
  ,
 message(ws,rawdata:any){
  console.log("this is message handler")
  try {
    console.log(rawdata);
    
    const data = rawdata as {
      type: string;
      roomId?:string
    };
  
  switch(data.type){

    case EVENTS.CONNECTED:
      break
    case EVENTS.CREATE_ROOM:
      const roomId:string=crypto.randomUUID();
      const creatorId=(ws.data as any).userId;
      const room=new Room(roomId,creatorId);
      room.gameStatus='waiting';
      rooms.set(roomId,room);
      console.log(room)
      console.log(roomId)
      
      ws.send(JSON.stringify({
        type: 'ROOM_CREATED',
        roomId
      }))
      break
    case EVENTS.JOIN_ROOM:
      const roomIdtoJoin=data.roomId;
      const joinedID=(ws.data as any).userId;
      if(!roomIdtoJoin){
        console.error("roomId is not available")
        ws.send(JSON.stringify({ type: "ERROR", message: "No room ID provided" }));
        break;
      
      }
     const targetRoom= rooms.get(roomIdtoJoin);
     if(!targetRoom){
      console.error("Room doesnt exist")
      ws.send(JSON.stringify({ type: "ERROR", message: "No room exists" }));
      break;
     }

     if(targetRoom.gameStatus!=='waiting'){
      ws.send(JSON.stringify({
        type:"ERROR",
        message:"The game is already active"
      }))

     }
     if(targetRoom.isFull()){
      ws.send(JSON.stringify({
        type:"ERROR",
        message:"The room is full"
      }))

      return;
     }
     targetRoom.addPlayer(joinedID);
     targetRoom.gameStatus='active';

     const joinPayload = JSON.stringify({
      type: 'ROOM_JOINED',
      roomId: roomIdtoJoin,
      players:targetRoom.players,
      gameStatus: targetRoom.gameStatus,
      // You can pass specific player assignments here if your room tracks them:
      // whitePlayer: targetRoom.creatorId,
      // blackPlayer: joinerId
    });
    for (const playerId of targetRoom.players) {
      const player = users.get(playerId);
  
      if (player) {
          player.ws.send(joinPayload);
      }
  }

  
      break
    case EVENTS.MOVE:
      break
    case EVENTS.CHESS_FEN:
      break
    case EVENTS.CHESS_HISTORY:
      break
    case EVENTS.PLAYER_LEFT:
      break
    case EVENTS.CHESS_STATE:
      break
  }



  } catch (error) {
    console.error(error)
  }
   

  }

})

.listen(3500,()=>{
  console.log("server starts at 3500")
})
