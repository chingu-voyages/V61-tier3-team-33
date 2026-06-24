import { Elysia } from 'elysia'
import type { Room, User } from '../Rooms/room.type'

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

})

.listen(3500)
