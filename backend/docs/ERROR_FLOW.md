# Error Flow Document

Every error path from client input → server validation → command execution → client notification.
Each error code has a unique human-readable message. Overloaded codes have been split into
specific sub-codes so the message alone identifies the real culprit.

---

## Protocol-level errors

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 1 | `invalid-payload` | `Unparseable or unknown command.` | `gateway.ts:48` | JSON decode returns null or `Command.isValid` fails | `Reply.error()` |
| 2 | `not-implemented` | `Command type not implemented.` | `mediator.ts:119` | Unknown command `type` hits switch default | `Reply.error()` |
| 3 | `not-authenticated` | `Session not found.` | `auth.ts:21` | `sessions.bySocket(ws)` returns null for non-handshake command | `Reply.error()` |
| 4 | `internal-error` | `An unexpected error occurred.` | `replies.ts` fallback | Error code not found in ErrorMessages map | `Reply.error()` |

---

## Room errors

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 5 | `room-full` | `The room is full.` | `game.ts:187` | `game.join()` — slot for the color is already taken | Mediator → `Reply.error()` |
| 6 | `invalid-mode` | `Cannot join in the current game state.` | `game.ts:184` | `game.join()` — game is FINISHED | Mediator → `Reply.error()` |
| 7 | `room-not-found` | `Room not found.` | `join.ts:23` | `JoinCommand.run()` — explicit `roomId` does not match any game | Mediator → `Reply.error()` |

---

## Game-level errors

### Not in game — gated at Mediator level

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 8 | `not-in-game` | `You are not in a game.` | `mediator.ts` (10×) | Any game command when `Context.inGame(ctx)` is false | `Reply.error()` |

### Game not found — game was swept from memory

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 9 | `game-not-found` | `That game no longer exists.` | `move.ts:21`, `resign.ts:19`, `sync.ts:18`, `select-position.ts:19`, `undo.ts:48,96,151,171` | `games.get()` returns null for the player's room ID | Mediator → `Reply.error()` |

### Game over — attempted action on a finished game

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 10 | `game-over` | `The game is already over.` | `game.ts:207,236,242,280` | `selectPosition()` / `move()` / `resign()` when `status !== ACTIVE` or `chess.isOver()` | `MOVE_REJECTED` / `POSITION_REJECTED` notif |

### Turn & piece errors

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 11 | `not-your-turn` | `It's not your turn.` | `game.ts:210,239` | `selectPosition()` / `move()` when `chess.sideToMove() !== color` | `MOVE_REJECTED` / `POSITION_REJECTED` notif |
| 12 | `not-your-turn` | `It's not your turn.` | `undo.ts:66` | `UndoCommand.request()` — the player who just moved cannot request undo (only the opponent can) | Mediator → `Reply.error()` |
| 13 | `illegal-move` | `That move is not legal.` | `game.ts:267` | `move()` catches `IllegalMoveError` from chess engine | `MOVE_REJECTED` notif |
| 14 | `square-empty` | `That square is empty.` | `game.ts:215,245` | `selectPosition()` / `move()` — source position has no piece | `POSITION_REJECTED` / `MOVE_REJECTED` notif |
| 15 | `not-your-piece` | `That piece belongs to your opponent.` | `game.ts:218` | `selectPosition()` — piece at position does not belong to the selecting color | `POSITION_REJECTED` notif |

### Resign errors

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 16 | `not-seated` | `You cannot resign — you are not seated in this game.` | `game.ts:285` | `resign()` — the resigning color is not in `slots` | Mediator → `Reply.error()` |

### Undo errors

| # | Error Code | Message | Source | Trigger | Sent Via |
|---|-----------|---------|--------|---------|----------|
| 17 | `undo-inactive` | `You cannot undo — the game is not active.` | `game.ts:366`, `undo.ts:54` | `undo()` / `UndoCommand.request()` — game is finished or waiting | Mediator → `Reply.error()` |
| 18 | `no-history` | `There are no moves to undo.` | `game.ts:363,388`, `undo.ts:60` | `undo()` — `this.status === WAITING` or `NothingToUndoError` caught; UndoCommand — `!game.canUndo` | Mediator → `Reply.error()` |
| 19 | `not-allowed` | `Cannot request undo again without a move in between.` | `undo.ts:73` | `UndoCommand.request()` — ratchet: `moveSeq <= lastResolvedSeq` | Mediator → `Reply.error()` |
| 20 | `pending-conflict` | `There's already a pending undo request.` | `undo.ts:79,102,109,156,179,184` | `UndoCommand.*()` — consent state machine rejects transition | Mediator → `Reply.error()` |

---

## Notification-internal errors (carried by `move:rejected` / `position:reject`)

These errors are sent via Notification, not `Reply.error()`. They carry the error code
as a `reason` field but NOT the human-readable message. The frontend must display
contextually (see frontend handlers below).

| Notification | Error Codes Carried |
|-------------|-------------------|
| `move:rejected` | `game-over`, `not-your-turn`, `illegal-move`, `square-empty` |
| `position:reject` | `game-over`, `not-your-turn`, `square-empty`, `not-your-piece` |

---

## Error flow diagram

```
Client WebSocket
 │
 ▼
Gateway.handleMessage(raw)
 │
 ├── JsonCodec.decode(raw) → null
 │   └── Reply.error(ws, INVALID_PAYLOAD)        #1: "Unparseable or unknown command."
 │
 └── Command.isValid(cmd) → false
     └── Reply.error(ws, INVALID_PAYLOAD)        #1
     │
     ▼
   Mediator.handle(ws, cmd)
     │
     ├── Auth.resolve(ws) → null
     │   └── Reply.error(ws, NOT_AUTHENTICATED)  #3: "Session not found."
     │
     ├── switch default
     │   └── Reply.error(ws, NOT_IMPLEMENTED)    #2: "Command type not implemented."
     │
     ├── ROOM_JOIN → join()
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── JoinCommand.run()
     │       ├── err(ROOM_NOT_FOUND) → Reply.error()          #7
     │       ├── err(ROOM_FULL) → Reply.error()               #5
     │       └── err(INVALID_MODE) → Reply.error()            #6
     │
     ├── ROOM_LEAVE → leave()
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── LeaveCommand.run() → silent (no error sent)
     │
     ├── MOVE_MAKE → move()
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── MoveCommand.run() → Game.move()
     │       ├── err(GAME_NOT_FOUND) → Reply.error()          #9
     │       ├── err(GAME_OVER) → MOVE_REJECTED notif         #10
     │       ├── err(NOT_YOUR_TURN) → MOVE_REJECTED notif     #11
     │       ├── err(SQUARE_EMPTY) → MOVE_REJECTED notif      #14
     │       └── err(ILLEGAL_MOVE) → MOVE_REJECTED notif      #13
     │
     ├── UNDO_REQUEST → requestUndo()
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── UndoCommand.request()
     │       ├── err(GAME_NOT_FOUND) → Reply.error()          #9
     │       ├── err(UNDO_INACTIVE) → Reply.error()           #17
     │       ├── err(NO_HISTORY) → Reply.error()              #18
     │       ├── err(NOT_YOUR_TURN) → Reply.error()           #12
     │       ├── err(NOT_ALLOWED → ratchet) → Reply.error()   #19
     │       └── err(PENDING_CONFLICT) → Reply.error()        #20
     │
     ├── UNDO_ACCEPT / DECLINE / CANCEL → acceptUndo() etc.
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── UndoCommand.*()
     │       ├── err(GAME_NOT_FOUND) → Reply.error()          #9
     │       └── err(PENDING_CONFLICT) → Reply.error()        #20
     │
     ├── GAME_RESIGN → resign()
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── ResignCommand.run() → Game.resign()
     │       ├── err(GAME_NOT_FOUND) → Reply.error()          #9
     │       ├── err(GAME_OVER) → Reply.error()               #10
     │       └── err(NOT_SEATED) → Reply.error()              #16
     │
     ├── STATE_SYNC → sync()
     │   ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
     │   └── SyncCommand.run()
     │       └── err(GAME_NOT_FOUND) → clear session + Reply.error()  #9
     │
     └── POSITION_SELECT → selectPosition()
         ├── Context.inGame? → NO → Reply.error(NOT_IN_GAME)  #8
         └── SelectPositionCommand.run() → Game.selectPosition()
             ├── err(GAME_NOT_FOUND) → Reply.error()          #9
             ├── err(GAME_OVER) → POSITION_REJECTED notif     #10
             ├── err(NOT_YOUR_TURN) → POSITION_REJECTED notif #11
             ├── err(SQUARE_EMPTY) → POSITION_REJECTED notif  #14
             └── err(NOT_YOUR_PIECE) → POSITION_REJECTED notif #15
```

---

## Frontend error handling

| Error Code | Frontend Handler | Behaviour |
|-----------|-----------------|-----------|
| `invalid-payload` | `SessionProvider` | Clears token, shows toast, retries handshake |
| `not-authenticated` | `SessionProvider` | Clears token, shows toast, retries handshake |
| `internal-error` | `SessionProvider` | Shows toast, retries handshake |
| `room-not-found` | `RoomProvider` — `ROOM_RESET_CODES` | Resets room state (silent — clears stale room) |
| `not-in-game` | `RoomProvider` — `ROOM_RESET_CODES` | Resets room state (silent — clears stale room) |
| `not-implemented` | `undefined` (unhandled) | Ignored |
| `room-full` | `undefined` (unhandled) | Ignored |
| `game-over` | `undefined` (unhandled) | Ignored |
| `no-history` | `RoomProvider` — `UNDO_ERROR_MESSAGES` | Shows toast: "There are no moves to undo yet" |
| `pending-conflict` | `RoomProvider` — `UNDO_ERROR_MESSAGES` | Shows toast: "There's already a pending undo request" |
| `not-allowed` | `RoomProvider` — `UNDO_ERROR_MESSAGES` | Shows toast: "Cannot request undo again without a move in between" |
| `not-your-turn` | `RoomProvider` — `UNDO_ERROR_MESSAGES` | Shows toast: "It's not your turn to request an undo" |
| `game-not-found` | `RoomProvider` — `UNDO_ERROR_MESSAGES` | Shows toast: "This game no longer exists" |
| `undo-inactive` | `RoomProvider` (planned) | Shows toast: "You cannot undo — the game is not active" |
| `not-seated` | `RoomProvider` (planned) | Shows toast: "You cannot resign — you are not seated in this game" |

### Move/Select errors (carried by notification, not `session:error`)

| Notification | Error Codes | Frontend Handler | Behaviour |
|-------------|------------|-----------------|-----------|
| `move:rejected` | `game-over`, `not-your-turn`, `illegal-move`, `square-empty` | Chess provider `rejectMove()` | Reverts local board, stores reason in state (no toast) |
| `position:reject` | `game-over`, `not-your-turn`, `square-empty`, `not-your-piece` | Chess provider `selectRejected()` | Clears selection (no toast, no state) |

---

## Error Messages map (backend `result.ts`)

```typescript
const ErrorMessages: Record<string, string> = {
  "invalid-payload":    "Unparseable or unknown command.",
  "not-implemented":    "Command type not implemented.",
  "not-authenticated":  "Session not found.",
  "room-full":          "The room is full.",
  "invalid-mode":       "Cannot join in the current game state.",
  "room-not-found":     "Room not found.",
  "not-in-game":        "You are not in a game.",
  "game-over":          "The game is already over.",
  "game-not-found":     "That game no longer exists.",
  "not-your-turn":      "It's not your turn.",
  "illegal-move":       "That move is not legal.",
  "square-empty":       "That square is empty.",
  "not-your-piece":     "That piece belongs to your opponent.",
  "no-history":         "There are no moves to undo.",
  "undo-inactive":      "You cannot undo — the game is not active.",
  "not-seated":         "You cannot resign — you are not seated in this game.",
  "not-allowed":        "Cannot request undo again without a move in between.",
  "pending-conflict":   "There's already a pending undo request.",
  "rate-limited":       "Please wait a moment before requesting an undo again.",
  "internal-error":     "An unexpected error occurred.",
};
```
