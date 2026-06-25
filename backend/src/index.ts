import { Elysia } from 'elysia'
import type { Room, User } from '../Rooms/room.type'
import { EVENTS } from '../Rooms/event';

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
      type: 'connected',
      userId: id
    }))

    console.log(id)
  }
  ,
 message(ws,rawdata:string){
  const data=JSON.parse(rawdata);

  switch(data.type){
    case EVENTS.CONNECTED:
      break
    case EVENTS.CREATE_ROOM:
      break
    case EVENTS.JOIN_ROOM:
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




  }

})

.listen(3500)