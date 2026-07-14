# Server Architecture & WebSocket Protocol

## Overview

The backend is an **authoritative multiplayer chess server**. It owns all game logic, validation, state transitions, and room lifecycle. Clients render the board and forward player actions — they never compute positions locally.

All communication uses JSON messages with a mandatory `type` field (colon-delimited namespacing, e.g. `room:join`, `move:made`).

---

# Architecture

## Module map

Modules are grouped by role, not by a strict stack. Dependencies are explicit — interfaces are injected at the composition root so wiring is a runtime decision, not a compile-time layer.

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         Composition Root                                │
  │  transport/gateway.ts — instantiates and wires every module             │
  │  Creates Mediator → ServiceRegistry → command classes, stores, Hub     │
  │  Injects dependencies via constructor arguments — no global singletons  │
  └─────────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │                    Mediator (events/mediator.ts)                      │
   │                                                                       │
   │  Central command dispatcher. Every WebSocket message arrives here:    │
   │  switch(cmd.type) → handler method → service command → Hub emit      │
   │                                                                       │
   │  Also subscribes to Hub events (connection closed, clock expired,     │
   │  grace expired, game ended, move made) for cross-cutting side effects.│
   │                                                                       │
   │  ⚠ Will grow large — planned to split into domain-specific mediators │
   └───────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │                    Service Registry (services/registry.ts)            │
   │                                                                       │
   │  Groups all command classes into typed facades:                       │
   │    registry.game    — join, leave, move, resign, undo, sync, select   │
   │    registry.emote   — emote send                                      │
   │    registry.connection — identify, close, pong                        │
   │                                                                       │
   │  Each command is a class with a single .run() method returning Result │
   └───────────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────────┐
   │                         Application Modules                           │
   │                                                                       │
   │  transport/        gateway.ts, connections.ts                         │
   │                    WebSocket lifecycle, message routing, outbound     │
   │                    delivery, disconnect grace (owns Grace timer)      │
   │                                                                       │
   │  services/         game/ (registry, join, leave, move, undo,          │
   │                    resign, sync, select-position),                    │
   │                    emote/ (send),                                     │
   │                    connection/ (identify, close, pong)                │
   │                    Orchestration layer — thin command classes,        │
   │                    no shared GameService god-class                    │
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
   │  events/           mediator.ts, hub.ts                                │
   │                    Mediator: command dispatcher + side-effect events   │
   │                    Hub: pub/sub event bus with FAST/DEFERRED lanes    │
   │                                                                       │
   │  protocol/         commands.ts, events.ts, replies.ts, errors.ts      │
   │                    Wire message shapes and string constants.          │
   │                    No serialization logic — pure type definitions     │
   │                                                                       │
   │  codec/            codec.ts, json.ts                                  │
   │                    Swappable wire format. Codec interface             │
   │                    (decode/encode), JsonCodec implementation          │
   │                                                                       │
   │  types/            chess.ts, game.ts, result.ts, clock.ts,            │
   │                    consent.ts, priority.ts, context.ts                │
   │                    Branded primitives and shared domain types.        │
   │                    Pure definitions, no logic                         │
   │                                                                       │
   │  store/            game/games.ts, game/game-store.ts                  │
   │                    session/sessions.ts, session/session-store.ts      │
   │                    In-memory data access with Reader + Writer pattern │
   │                    GameStore: games Map + waiting queue + sweeping    │
   │                    SessionStore: triple-indexed (socket, token, ID)   │
   │                                                                       │
   │  util/             switcher.ts, grace.ts, retry.ts, mutex.ts,         │
   │                    consent.ts                                         │
   │                    Three-phase room switching, disconnect grace       │
   │                    period, async retry with backoff, exclusive lock,  │
   │                    consent manager for undo/draw handshakes           │
   └───────────────────────────────────────────────────────────────────────┘
```

### Who depends on what

| Module | Depends on |
|---|---|
| **Transport** (gateway) | everything — it's the composition root |
| **Transport** (connections) | `types/`, `protocol/`, `codec/`, `events/`, `session/`, `util/` |
| **Mediator** | `types/`, `protocol/`, `codec/`, `events/`, `session/`, `services/`, `store/`, `util/` |
| **Services** | `types/`, `protocol/`, `events/`, `codec/`, `session/`, `game/`, `occupant/`, `clock/`, `store/`, `util/` |
| **Session** | `types/`, `store/` |
| **Game** | `types/`, `protocol/`, `events/`, `occupant/`, `clock/`, `util/`, `chess/core` |
| **Occupant** | `types/`, `protocol/`, `codec/` |
| **Clock** | `types/`, `protocol/`, `events/` |
| **Players** | `types/` |
| **Credential** | (none) |
| **Protocol** | `types/` |
| **Codec** | `protocol/` |
| **Events** (Hub) | `protocol/` (Event types) |
| **Types** | `chess/core` |
| **Store** | `session/`, `game/`, `types/` |
| **Util** | `types/`, `protocol/` |

### Data flow

```
WebSocket message arrives
  → Gateway.handleMessage(ws, raw)
    → getCodec().decode(raw)             # parse + validate raw bytes → Command
      → Command.isValid(cmd)             # shape guard
        → mediator.handle(ws, cmd)
          → Auth.resolve(ws)             # resolve session → PlayerContext
            → switch(cmd.type)
              ├── session:*   → mediator.identify / pong
              │                 → service.connection.identify / pong
              ├── room:join   → mediator.join
              │                 → service.game.join.run(ctx, cmd)
              ├── room:leave  → mediator.leave
              │                 → service.game.leave.run(ctx)
              ├── move:make   → mediator.move
              │                 → service.game.move.run(ctx, cmd)
              │                   → Game.move(color, input)  [mutex-guarded]
              │                     → publisher.emit(Notifications.moveMade(...))
              │                       → occupant.notify(event)
              │                         → codec.encode(event) → ws.send(json)
              ├── undo:*      → mediator.*Undo
              │                 → service.game.undo.run(ctx, command)
              ├── game:resign → mediator.resign
              │                 → service.game.resign.run(ctx)
              ├── state:sync  → mediator.sync
              │                 → service.game.sync.run(ctx)
              ├── position:*  → mediator.selectPosition
              │                 → service.game.selectPosition.run(ctx, cmd)
              └── emote:send  → mediator.emoteSend
                                → service.emote.send.run(ctx, cmd)
```

Error responses are sent immediately via `Reply.error(ws, code)` — the codec encodes the reply and sends it directly over the socket, bypassing the Hub.

Side-effect events (connection closed, clock expired, grace expired) are handled by `Mediator.setup()` which subscribes to the Hub. Some events are emitted by command classes before reaching the Mediator:

```
CloseCommand.run(ws)
  → sessions.drop(ws)                             # remove socket binding
  → publisher.emit(Signals.connectionClosed(id, ws))
  → grace.start(id, color, timeout, cb)            # start grace timer
    → ... on timeout ...
    → publisher.emit(Notifications.graceExpired(roomId, color))

Hub receives grace:expired
  → Mediator.onGraceExpired
    → games.get(roomId)?.abandon()                 # forfeit disconnected player

Hub receives clock:expired
  → Mediator.onClockExpired
    → games.get(roomId)?.expire()                  # flag timeout loss

Hub receives game:ended
  → Mediator.onGameEnded
    → clears pending undo state

Hub receives move:made
  → Mediator.onMoveMade
    → invalidates pending undo
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
  "token": "uuid",
  "roomId": null
}
```

The client should cache `playerId` and `token` for the WebSocket's lifetime. `roomId` is non-null when resuming an existing game session after reconnection.

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

### `emote:send`

Send an emote to the opponent.

```json
{
  "type": "emote:send",
  "emote": "👍"
}
```

| Field | Type | Description |
|---|---|---|
| `emote` | `string` | One of: `👍`, `😅`, `🤔`, `🎉`, `😤`, `⚡` |

Subject to a 7-second per-player per-game cooldown.

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
    "status": 1,
    "winner": 0,
    "hasWinner": true,
    "drawReason": 0,
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

### `emote:received`

Delivered to the opponent when an emote is sent.

```json
{
  "type": "emote:received",
  "roomId": "uuid",
  "emote": "👍"
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

Replies are session-level responses that bypass the `Hub`. They use the Codec for serialization, then send directly over the socket.

### HandshakeReply

Sent in response to `session:handshake`. See [Connection](#connection).

```json
{
  "type": "session:handshake",
  "playerId": "uuid",
  "token": "uuid",
  "roomId": null
}
```

### ErrorReply

Sent when a session-level action fails (before the command reaches a service).

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
| `room-full` | Room already has two players |
| `invalid-mode` | Room is not in a joinable state |
| `internal-error` | Unexpected server failure |

Game-level errors are returned via `move:rejected` / `position:reject` notifications or `session:error` replies with typed error codes:

| Domain | Error values |
|---|---|
| `MoveError` | `not-your-turn`, `illegal-move`, `game-over`, `square-empty` |
| `SelectError` | `game-over`, `not-your-turn`, `square-empty`, `not-your-piece` |
| `RoomError` | `room-full`, `invalid-mode`, `room-not-found` |
| `UndoError` | `no-history`, `pending-conflict`, `not-allowed`, `undo-inactive`, `not-seated`, `rate-limited` |

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

The architecture has explicit seams for common extensions. Each extension point maps to a specific file or pattern.

## Adding a new command

1. **Add a constant** in `protocol/commands.ts`:
   ```ts
   export const DRAW_OFFER = "draw:offer" as const
   ```
   Add the shape to the `Command` union type.

2. **Add a notification event** in `protocol/events.ts` if the response needs a new event type.

3. **Create a command class** in `services/`:
   ```ts
   // services/draw/offer.ts
   export class DrawOfferCommand {
     constructor(private games: GameStore, private publisher: Publisher) {}
     run(ctx: PlayerContext): Result<void, DrawError> { ... }
   }
   ```

4. **Add to ServiceRegistry** (`services/registry.ts`):
   ```ts
   readonly draw: { offer: DrawOfferCommand }
   ```

5. **Add a case + handler** in `events/mediator.ts`:
   ```ts
   case DRAW_OFFER: return this.drawOffer(ws, ctx, cmd)
   ```

6. **Wire in the Gateway** — though the Gateway delegates to Mediator, no Gateway change is needed since all commands route through `mediator.handle()`.

## Extension: Clock (new time-control strategies)

1. **Create a strategy class** in `clock/` implementing the `Clock` interface:
   ```ts
   export class FischerClock implements Clock { ... }
   ```
   Choose a base class (`MoveClock` for per-move reset, `MatchClock` for match-length).

2. **Add a `ClockFormat` value** in `types/clock.ts`:
   ```ts
   export const FISCHER = ClockFormat("fischer")
   ```

3. **Register in `clock/factory.ts`** so `createClock(FISCHER)` returns the new strategy.

4. **Test your strategy** — timer tests use mock strategies and cover the full lifecycle.

See [chess.md](chess.md) for the clock reference and step-by-step guide.

## Extension: Service (new domain capabilities)

New capabilities that don't fit existing commands (chat, replays, analytics, tournament management) should be written as standalone services:

1. **Define commands/events** in `protocol/` following existing patterns.

2. **Create a command class** in `services/<domain>/`:
   ```ts
   export class ChatSendCommand {
     constructor(private publisher: Publisher, private sessions: SessionStore) {}
     run(ctx: PlayerContext, message: string): Result<void, ChatError> { ... }
   }
   ```

3. **Register in `ServiceRegistry`** — add a field and wire it in the constructor.

4. **Wire in `Mediator`** — add a `case` and handler method.

Services are testable in isolation. They receive dependencies through their constructor and interact with the rest of the system through the Hub and stores.

## Extension: Store (persistent backends)

Swap the in-memory stores for persistent backends (Redis, SQLite, Postgres):

```ts
class RedisGameStore implements GameReader, GameWriter { ... }
class RedisSessionStore implements SessionReader, SessionWriter { ... }
```

Each store interface is a pair of `Reader`+`Writer` interfaces:

```ts
interface GameReader {
  get(id: string): Game | null
  findWaiting(mode: Mode, format: ClockFormat): Game | null
}
interface GameWriter {
  create(id?: string, mode?: Mode, clock?: Clock): Game
  commit(id: string, game: Game): void
  drop(id: string): void
  sweep(): number
  startSweeping(intervalMs: number): void
  stopSweeping(): void
}

interface SessionReader {
  bySocket(ws: WebSocket): Session | null
  byToken(token: string): Session | null
  byPlayerId(playerId: string): Session | null
}
interface SessionWriter {
  open(ws: WebSocket, playerId: string): Session
  resume(token: string, ws: WebSocket): Session | null
  resumeOrOpen(ws: WebSocket, token?: string): Session
  drop(ws: WebSocket): void
  bind(ws: WebSocket, patch: Partial<Session>): void
}
```

Swap implementations at the composition root — no other code changes.

## Extension: Mediator (new side-effect hooks)

New side-effects (e.g. analytics tracking, tournament bracket advancement, achievement unlocking) are added by subscribing to the Hub.

**Inside Mediator.setup()** — use the private `this.on()` helper, which delegates to `this.hub.on()`:

```ts
// In Mediator.setup():
this.on(GAME_ENDED, this.onGameEnded.bind(this), FAST)
```

**Outside the Mediator** (standalone service) — subscribe directly on the Hub instance:

```ts
const hub = new Hub()

// Subscribe to a specific event type:
const unsub = hub.on(GAME_ENDED, (roomId, event) => {
  analytics.record({ roomId, result: event.result })
})

// Or subscribe to all events:
hub.onAny((roomId, event) => {
  analytics.record({ roomId, event, timestamp: Date.now() })
}, DEFERRED)
```

This is the same pattern used by the grace-period system — no existing code needs to change.

---

# Future concerns

## Mediator god-object

The `Mediator` currently handles **all** command routing and **all** side-effect subscriptions. As features grow, it will accumulate:

- Every new command type adds a `case` and a handler method
- Every new side-effect adds a `setup()` subscription

This is already visible with the current set: room commands, move commands, undo commands, resign, sync, select, emote, plus event subscriptions for connection, clock, grace, game-end, and move-made.

**Planned split:** Decompose into domain-specific mediators:

```ts
class GameMediator {
  constructor(private gameService: CommandRegistry) {}
  handle(cmd: GameCommand): Result { ... }
}

class RoomMediator {
  constructor(private roomService: RoomCommands) {}
  handle(cmd: RoomCommand): Result { ... }
}

class MainMediator {
  private mediators = [new GameMediator(...), new RoomMediator(...), ...]
  handle(ws, cmd): void {
    const m = this.mediators.find(m => m.canHandle(cmd))
    m?.handle(cmd)
  }
}
```

This keeps the switch statement small, isolates handler logic per domain, and makes each sub-mediator independently testable.

## Other known evolutions

| Concern | Plan |
|---|---|
| **Singleton game store** | Replace in-memory `Map` with a persistent backend (Redis) via `GameReader`/`GameWriter` interfaces |
| **Session TTL** | Move session expiry from periodic sweep to Redis TTL or a dedicated expiry service |
| **Cross-room notifications** | Tournament/friend-list events need a user-level subscription layer beyond per-room Hub subscriptions |
| **Rate limiting** | Add a `RateLimiter` utility and apply per-command in the Mediator or as a Hub middleware |
| **Observability** | Add structured logging middleware in the Hub (FAST lane) to record every event with timing |

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

3. **Interface-based injection** — All significant collaborators (`Codec`, `SessionStore`, `GameStore`, `Publisher`, `Subscriber`, `Occupant`, `Clock`, `Timer`) are interfaces. Concrete implementations are injected at the composition root.

4. **Event-driven internals** — The `Hub` decouples producers from consumers. `Game` emits events without knowing who listens. Services subscribe to clock, connection, and game events without knowing who emits them.

5. **Thin command classes** — Each command is a single-responsibility class with a `.run()` method returning `Result<T, E>`. No shared god-class orchestrates all game operations.

6. **Separation of concerns** — Transport owns sockets. Mediator owns routing. Services own orchestration. Game owns chess logic. Protocol owns message shapes. Codec owns serialization. Hub owns dispatch. Store owns persistence.

7. **Result types over exceptions** — Fallible operations return `Result<T, E>` (discriminated union) instead of throwing.

8. **Branded types** — Distinct concepts (Lifecycle, Mode, Position, PieceColor) are branded to prevent type confusion.

9. **Layered dependency direction** — Dependencies flow inward. No module depends on the layer above it.
