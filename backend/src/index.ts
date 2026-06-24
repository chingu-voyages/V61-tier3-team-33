import { Elysia } from 'elysia'

const users = new Map<string, any>()

new Elysia()

.ws('/ws', {


  open(ws) {
    console.log("connection has opened")

    const id = crypto.randomUUID();

    (ws.data as any).userId = id

    users.set(id, ws)
    ws.send(JSON.stringify({
      type: 'connected',
      userId: id
    }))

    console.log(id)
  }

})

.listen(3500)