# Server Architecture & WebSocket Protocol

## Overview

The backend is an **authoritative multiplayer chess server**. It owns all game logic, validation, state transitions, and room lifecycle. Clients render the board and forward player actions — they never compute positions locally.

All communication uses JSON messages with a mandatory `type` field (colon-delimited namespacing, e.g. `room:join`, `move:made`).

---

# Architecture

## Module map

Modules are grouped by role, not by a strict stack. Dependencies are explicit — interfaces are injected at the composition root (`Gateway`), so what depends on what is a runtime wiring decision, not a compile-time layer.

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         Composition Root                                │
  │  transport/gateway.ts — instantiates and wires every module             │
  │  Reads config, creates Hub, Sessions, Games, GameService, etc.          │
  │  Injects dependencies via constructor arguments — no global singletons  │
  └─────────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │                       Application Modules                             │
   │                                                                       │
   │  transport/        gateway.ts, connections.ts                         │
   │                    WebSocket lifecycle, message routing, outbound     │
   │                    delivery, disconnect grace (owns Grace timer)      │
   │                                                                       │
   │  services/         game-service.ts, game-facade.ts                    │
   │                    Orchestration layer — routes commands to the       │
   │                    correct game, manages undo handshake, handles      │
   │                    grace expiry, dispatches notifications via Hub     │
   │                                                                       │
   │  session/          session.ts, sessions.ts, session-store.ts          │
   │                    Player identity — token-based resume/reconnect,    │
   │                    socket-to-player binding, session lifecycle        │
   └───────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │                         Domain Modules                                │
   │                                                                       │
   │  game/             game.ts, games.ts, game-store.ts                   │
   │                    Single chess match — owns the Chess engine, two    │
   │                    occupant slots (by color), clock strategy, room    │
   │                    lifecycle: WAITING → ACTIVE → FINISHED             │
   │                                                                       │
   │  occupant/         occupant.ts, human.ts                              │
   │                    Abstraction for "a player in a seat". Human        │
   │                    sends events over WebSocket; AI or Spectator       │
   │                    would add new implementations of same interface    │
   │                                                                       │
   │  clock/            clock.ts, timer.ts, factory.ts, move/, match/      │
   │                    Time-control strategies. Clock (interface),        │
   │                    Timer (running clock), concrete strategy classes   │
   │                                                                       │
   │  players/          player.ts, players.ts, inMemoryPlayers*.ts         │
   │                    Player profile data (name, rating, stats)          │
   │                                                                       │
   │  credential/       credentials.ts, in-memory-credentials.ts           │
   │                    Auth credential storage (password-based)           │
   └───────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │                     Infrastructure Modules                            │
   │  (Cross-cutting — depended on by multiple modules above)              │
   │                                                                       │
   │  protocol/         commands.ts, events.ts, replies.ts, errors.ts      │
   │                    Wire message shapes and string constants.          │
   │                    No serialization logic — pure type definitions     │
   │                                                                       │
   │  codec/            codec.ts, json.ts                                  │
   │                    Swappable wire format. Codec interface             │
   │                    (decode/encode), JsonCodec implementation          │
   │                                                                       │
   │  bus/              hub.ts                                             │
   │                    In-process event bus. Two priority lanes:          │
   │                    FAST (sync) and DEFERRED (macrotask). Typed        │
   │                    dispatch + wildcard handlers. Error isolation      │
   │                                                                       │
   │  types/            chess.ts, game.ts, result.ts, clock.ts             │
   │                    Branded primitives and shared domain types.        │
   │                    Pure definitions, no logic                         │
   │                                                                       │
   │  util/             grace.ts, retry.ts, mutex.ts                       │
   │                    Infrastructure utilities — disconnect grace        │
   │                    period, async retry with exponential backoff,      │
   │                    exclusive async lock                               │
   └───────────────────────────────────────────────────────────────────────┘
```

### Who depends on what

| Module | Depends on |
|---|---|
| **Transport** (gateway) | everything — it's the composition root |
| **Transport** (connections) | `types/`, `protocol/`, `codec/`, `bus/`, `session/`, `util/` (Grace) |
| **Services** | `types/`, `protocol/`, `codec/`, `bus/`, `session/`, `game/`, `occupant/`, `clock/`, `util/` |
| **Session** | `types/` |
| **Game** | `types/`, `protocol/`, `bus/`, `occupant/`, `clock/`, `util/`, `chess/core` |
| **Occupant** | `types/`, `protocol/`, `codec/` |
| **Clock** | `types/`, `protocol/`, `bus/` |
| **Players** | `types/` |
| **Credential** | (none) |
| **Protocol** | `types/` |
| **Codec** | `protocol/` |
| **Bus** | `protocol/` (Event types) |
| **Types** | `chess/core` |
| **Util** | `types/`, `protocol/` |

### Data flow

```
WebSocket message arrives
  → Gateway.handleMessage(ws, raw)
    → codec.decode(raw)                   # parse + validate raw bytes → Command
      → switch(command.type)               # route by type string
        ├── session:*   → Connections.identify / pong
        ├── room:*      → GameService.join / leave
        ├── move:make   → GameService.move
        ├── undo:*      → GameService.requestUndo / accept / decline
        ├── game:resign → GameService.resign
        ├── state:sync  → GameService.sync
        └── position:*  → GameService.selectPosition
          → Game.<action>                  # chess logic, occupant dispatch
            → publisher.emit(event)        # Bus → subscribers (logging, etc.)
            → occupant.notify(event)       # deliver to player's socket
              → codec.encode(event)        # serialize
                → ws.send(json)            # send to client
```

---

# Connection

## WebSocket Endpoint

```
ws://localhost:3500/ws
```

On connection, the server assigns a unique socket ID. The client must complete a **handshake** before sending game commands.

### Handshake (Client → Server)

```json
{ "type": "session:handshake", "token": "<optional-token>" }
```

- Without a token: creates a new session, returns a fresh `playerId` and `token`.
- With a valid token: resumes the existing session (e.g. after reconnection).

### Handshake (Server → Client)

```json
{
  "type": "session:handshake",
  "playerId": "uuid",
  "token": "uuid"
}
```

The client should cache `playerId` and `token` for the WebSocket's lifetime.

### Keepalive

Client sends pongs to keep the connection alive:

```json
{ "type": "session:pong" }
```

---

# Protocol Reference

All wire messages use `type` strings with a `namespace:action` convention.

---

## Commands (Client → Server)

Commands are one-directional requests. The server never sends commands back.

### `session:handshake`

Authenticate or resume a session. See [Connection](#connection).

### `session:pong`

Keepalive response. No payload.

### `room:join`

Join a game room, optionally creating one.

```json
{
  "type": "room:join",
  "mode": 0,
  "roomId": "optional-room-uuid",
  "color": 0,
  "difficulty": 0
}
```

| Field | Type | Description |
|---|---|---|
| `mode` | `number` | 0 = human vs human, 1 = human vs AI, 2 = AI vs AI |
| `roomId` | `string?` | Existing room to join, or omit to create a new room |
| `color` | `number?` | Requested color (0 = white, 1 = black) |
| `difficulty` | `number?` | AI difficulty when applicable (0 = easy, 1 = medium, 2 = hard) |

The first player into a room becomes white. The room stays `waiting` until a second player joins, at which point it becomes `active`.

### `room:leave`

Leave the current room. No payload.

### `move:make`

Make a chess move.

```json
{
  "type": "move:make",
  "from": 12,
  "to": 28,
  "promoteTo": 4
}
```

| Field | Type | Description |
|---|---|---|
| `from` | `number` | Source square index (0–63) |
| `to` | `number` | Destination square index (0–63) |
| `promoteTo` | `number?` | Piece type for pawn promotion (4 = queen, 3 = rook, 2 = bishop, 1 = knight) |

### `undo:request`

Request to take back the last move. No payload. Starts a timed window for the opponent to accept/decline.

### `undo:accept`

Accept the opponent's undo request. No payload.

### `undo:decline`

Decline the opponent's undo request. No payload.

### `game:resign`

Resign the current game. No payload.

### `state:sync`

Request a full state sync (e.g. after reconnection). The server responds with a `move:made` notification carrying the latest snapshot.

### `position:select`

Select a square to see legal destinations (the click-a-piece step before `move:make`).

```json
{
  "type": "position:select",
  "position": 12
}
```

---

## Events (Server → Client)

Events are server-to-client notifications. They travel through the `Codec` and are dispatched to occupants via `Occupant.notify()`.

### `connection:opened`

Internal signal — not sent to clients. Indicates a new WebSocket connection.

### `connection:closed`

Internal signal — not sent to clients. Indicates a WebSocket disconnection.

### `connection:resumed`

Internal signal — not sent to clients. Indicates a session resume.

### `room:joined`

Broadcast to both players when the second player joins.

```json
{
  "type": "room:joined",
  "roomId": "uuid",
  "color": 0,
  "state": { /* GameSnapshot */ }
}
```

### `game:started`

Broadcast when the game becomes active.

```json
{
  "type": "game:started",
  "roomId": "uuid",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "turn": 0,
  "clock": { /* ClockState or null */ }
}
```

### `room:left`

Sent when a player leaves the room.

```json
{
  "type": "room:left",
  "roomId": "uuid",
  "color": 0
}
```

### `game:ended`

Broadcast when the game finishes.

```json
{
  "type": "game:ended",
  "roomId": "uuid",
  "result": {
    "status": "CHECKMATE",
    "winner": 0,
    "hasWinner": true,
    "drawReason": "NO_DRAW_REASON",
    "reason": 0
  },
  "winner": 0
}
```

### `move:made`

Broadcast after every successful move. Carries the full authoritative game snapshot.

```json
{
  "type": "move:made",
  "roomId": "uuid",
  "by": 0,
  "move": { "from": 12, "to": 28, "moveType": 0 },
  "isCheck": false,
  "isGameOver": false,
  "turn": 1,
  "result": null,
  "clock": { "whiteMs": 300000, "blackMs": 300000, "active": 1 }
}
```

### `move:rejected`

Sent to the acting player when a move is invalid.

```json
{
  "type": "move:rejected",
  "roomId": "uuid",
  "by": 0,
  "reason": "illegal-move",
  "from": 12,
  "to": 28
}
```

### `undo:requested`

Sent to the opponent when an undo is requested. Includes an `expiresAt` timestamp.

```json
{
  "type": "undo:requested",
  "roomId": "uuid",
  "by": 0,
  "expiresAt": 1700000000000
}
```

### `undo:applied`

Broadcast when an undo is accepted.

```json
{
  "type": "undo:applied",
  "roomId": "uuid",
  "state": { /* GameSnapshot */ },
  "clock": { /* ClockState or null */ }
}
```

### `undo:declined`

Sent to the requester when the opponent declines.

```json
{
  "type": "undo:declined",
  "roomId": "uuid",
  "by": 1
}
```

### `position:accept`

Response to `position:select` with legal destination squares.

```json
{
  "type": "position:accept",
  "roomId": "uuid",
  "position": 12,
  "moves": [28, 20, 16]
}
```

### `position:reject`

Response when the selected square has no legal moves or isn't the player's piece.

```json
{
  "type": "position:reject",
  "roomId": "uuid",
  "position": 12,
  "reason": "not-your-piece"
}
```

### `clock:started`

Emitted when a player's clock starts ticking.

```json
{
  "type": "clock:started",
  "roomId": "uuid",
  "color": 0,
  "remainingMs": 300000
}
```

### `clock:paused`

Emitted when a player's clock stops.

```json
{
  "type": "clock:paused",
  "roomId": "uuid",
  "color": 0,
  "remainingMs": 295000
}
```

### `clock:expired`

Emitted when a player runs out of time.

```json
{
  "type": "clock:expired",
  "roomId": "uuid",
  "color": 0
}
```

### `grace:started`

Emitted when a disconnected player enters their grace period.

```json
{
  "type": "grace:started",
  "roomId": "uuid",
  "color": 0,
  "deadlineMs": 1700000000000
}
```

### `grace:cancelled`

Emitted when the disconnected player reconnects before the grace period expires.

```json
{
  "type": "grace:cancelled",
  "roomId": "uuid",
  "color": 0
}
```

### `grace:expired`

Emitted when the grace period expires without reconnection. The game is then abandoned.

```json
{
  "type": "grace:expired",
  "roomId": "uuid",
  "color": 0
}
```

---

## Replies (Server → Client)

Replies bypass the `Codec` and `Hub` — they are hand-serialized `JSON.stringify` sent directly over the socket. Used only for session-level responses.

### HandshakeReply

Sent in response to `session:handshake`. See [Connection](#connection).

```json
{
  "type": "session:handshake",
  "playerId": "uuid",
  "token": "uuid"
}
```

### ErrorReply

Sent when a session-level action fails (before the command reaches `GameService`).

```json
{
  "type": "session:error",
  "code": "invalid-payload",
  "message": "Unparseable or unknown command."
}
```

---

## Error Codes

Session-level errors returned via `ErrorReply`:

| Code | Meaning |
|---|---|
| `invalid-payload` | Malformed or unknown command |
| `not-implemented` | Command type exists but is not yet wired |
| `not-authenticated` | Command requires a handshake |
| `not-in-game` | Command requires an active game session |
| `room-not-found` | Referenced room does not exist |
| `game-full` | Room already has two players |
| `game-finished` | Game is over, no more moves accepted |
| `internal-error` | Unexpected server failure |

Game-level move rejection errors are returned via `move:rejected` / `position:reject` notifications with typed error codes:

| Domain | Error values |
|---|---|
| `MoveError` | `not-your-turn`, `illegal-move`, `game-over`, `square-empty` |
| `SelectError` | `game-over`, `not-your-turn`, `square-empty`, `not-your-piece` |
| `JoinError` | `room-full`, `invalid-mode` |
| `UndoError` | `no-history`, `pending-conflict`, `not-allowed` |

---

# Room Lifecycle

```
Client A                         Client B
   │                                 │
   │ room:join (no roomId)           │
   ├────────────────────────────────►│
   │                                 │
   │ room:joined (as white, waiting) │
   │◄────────────────────────────────┤
   │                                 │
   │                                 │  room:join (roomId)
   │                                 │◄───┤
   │                                 │
   │◄──────── room:joined ──────────►│  (broadcast)
   │◄──────── game:started ─────────►│
   │                                 │
   │◄───────── move:made ───────────►│  (after each move)
   │                                 │
   │  room:leave / game:resign       │
   │◄───────── game:ended ──────────►│
```

### Room states

| State | Meaning |
|---|---|
| `waiting` | One player present, moves rejected |
| `active` | Two players, moves accepted |
| `finished` | Game ended (checkmate / draw / resignation / abandon / timeout) |

### Grace period

When a player disconnects during an active game, a grace timer starts. If the player reconnects (with their session token) before the timer expires, play resumes. If the timer expires, the game is abandoned and the remaining player wins.

---

# Extensibility

The architecture has explicit seams for common extensions.

**Rule of thumb:** Only extend `GameService` for features that directly orchestrate game logic (moves, undo, resign, sync). Everything else — spectators, chat, notifications, analytics, replays — should be a standalone service that subscribes to the Hub and/or handles its own commands. Each service is testable in isolation and gets wired into the Gateway at the composition root.

## Spectator mode

To add read-only spectators:

1. **Create `SpectatorService`** that subscribes to the Hub for each room a spectator joins:
   ```
   export class SpectatorService {
     constructor(private hub: Hub, private codec: Codec) {}

     spectate(ws: WebSocket, roomId: RoomId) {
       const unsub = this.hub.onRoom(roomId, (event) => {
         this.codec.encode(event).then((raw) => ws.send(raw));
       });
       ws.on("close", () => unsub());
     }
   }
   ```
   No changes to `Occupant`, `OccupantKind`, or `GameService` — spectators are purely Hub subscribers, not occupants.

2. **Add a `room:spectate` command** in `commands.ts` (takes a `roomId`, no `mode`/`color`).

3. **Wire in `gateway.ts`**:
   ```
   const spectatorService = new SpectatorService(hub, codec);
   gateway.on("room:spectate", (ws, cmd) => spectatorService.spectate(ws, cmd.roomId));
   ```

   Outbound events flow through the Hub — spectators receive the same notifications as occupants but cannot send moves or game commands.

## Chat system

Chat messages are not game state — they should be handled as a **separate service**, not in `GameService`.

1. **Add chat commands** in `protocol/commands.ts`:
   ```
   export const CHAT_SEND = "chat:send" as const;
   // Command union: | { type: typeof CHAT_SEND; roomId: string; message: string }
   ```

2. **Add chat events** in `protocol/events.ts`:
   ```
   export const CHAT_RECEIVED = "chat:received" as const;
   // Notification: | { type: typeof CHAT_RECEIVED; roomId: string; playerId: string; message: string }
   ```

3. **Create a `ChatService`** that:
   - Subscribes to `CHAT_SEND` via a Hub handler
   - Broadcasts `CHAT_RECEIVED` to the room's occupants
   - Can optionally persist messages, filter profanity, rate-limit

4. **Wire `ChatService` in `Gateway`**:
   ```
   const chatService = new ChatService(hub, sessions);
   gateway.on(CHAT_SEND, (ws, cmd) => chatService.handle(ws, cmd));
   ```

Since chat is not part of `GameService`, it doesn't affect game logic and can be developed, tested, and deployed independently.

## Notification system

For push-style notifications (invites, friend requests, tournament alerts):

1. **Define notification commands/events** in `protocol/` following the existing pattern.

2. **Create a `NotificationService`** that:
   - Maintains a registry of playerId → socket mappings (reuses `SessionStore`)
   - Sends notifications via `Reply.send()` (hand-serialized, bypasses `Hub` and `Codec`)
   - Can be expanded to support offline delivery when the player is disconnected

3. **Wire in `Gateway`** alongside existing services.

## New game modes (Chess960, Bughouse)

1. **Add a `Mode` value** in `types/game.ts`:
   ```
   export const CHESS_960: Mode = Mode(3);
   ```

2. **Extend `Game`** — branch on `mode` in the constructor to:
   - Vary the starting position (randomize back rank for Chess960)
   - Vary the rules (captured pieces can be dropped for Bughouse)

3. **Extend `GameService.join`** to accept the new mode in `room:join`.

4. **Games waiting-queue** already partitions by `(mode, format)` — no matchmaking change needed.

## New clock formats (Fischer, Bronstein, Byoyomi)

1. **Create a strategy class** in `clock/` implementing the `Clock` interface:
   ```
   export class FischerClock implements Clock { ... }
   ```

2. **Add a `ClockFormat` value** in `types/clock.ts`:
   ```
   export const FISCHER = ClockFormat("fischer");
   ```

3. **Register in `clock/factory.ts`** so `createClock(FISCHER)` returns the new strategy.

## New wire formats (MsgPack, CBOR)

1. **Create a codec file** in `codec/` implementing the `Codec` interface:
   ```
   export class MsgPackCodec implements Codec { ... }
   ```

2. **Swap in `Gateway`**:
   ```
   const gateway = new Gateway(new MsgPackCodec(), ...);
   ```

The rest of the system (commands, events, services, game logic) is unchanged — the `Codec` interface is the only seam.

## New sinks for events (analytics, tournament feed, replay archive)

Subscribe to the `Hub` using `hub.onAny(handler)` or `hub.on(eventType, handler)`. The handler receives `(roomId, event)`. This is the same pattern used by `EventLog` and the grace-period system — no existing code needs to change.

```typescript
hub.onAny((roomId, event) => {
  analytics.record({ roomId, event, timestamp: Date.now() });
}, DEFERRED);
```

---

# Turn Encoding

```
0 = White
1 = Black
```

Square positions use **0–63 index encoding** (a1 = 0, b1 = 1, ..., h8 = 63).

---

# Board Synchronization

The backend is the **single source of truth**. Clients must never calculate future board positions.

**Client flow:**
1. Send `move:make` with `from` and `to` square indices.
2. Wait for `move:made` notification carrying the authoritative `GameSnapshot`.
3. Replace the current board with the received FEN.
4. If `move:rejected` is received, the move did not happen — the client's board was never modified.

This guarantees synchronisation — both players always observe the exact same position.

---

# Design Principles

1. **Server-authoritative** — The server owns all validation, game rules, and state transitions. Clients are rendering terminals.

2. **Parse, don't validate** — The `Codec` layer fully validates raw input into a typed `Command`. Code past the decode boundary never re-checks structure.

3. **Interface-based injection** — All significant collaborators (`Codec`, `SessionStore`, `GameStore`, `Publisher`, `Subscriber`, `Occupant`, `Clock`, `Timer`) are interfaces. Concrete implementations are injected at the composition root (`Gateway`).

4. **Event-driven internals** — The `Hub` decouples producers from consumers. `Game` emits events without knowing who listens. `GameService` subscribes to connection and clock events without knowing who emits them.

5. **Separation of concerns** — Transport owns sockets. Services own orchestration. Game owns chess logic. Protocol owns message shapes. Codec owns serialization. Bus owns dispatch.

6. **Result types over exceptions** — Fallible operations return `Result<T, E>` (discriminated union) instead of throwing.

7. **Branded types** — Distinct concepts (Lifecycle, Mode, Position, PieceColor) are branded to prevent type confusion.

8. **Layered dependency direction** — Dependencies flow inward. No module depends on the layer above it.
