# WebSocket Protocol

# Multiplayer Chess WebSocket Protocol

## Overview

This document defines the communication protocol between the Chess Multiplayer frontend and backend over WebSockets.

The backend acts as the **authoritative game server**, meaning every chess rule, move validation, game state transition, and room lifecycle is controlled exclusively by the server.

Clients are responsible only for:

- Rendering the current board
- Sending player actions
- Displaying updates received from the server

Clients **must never** modify the chess position locally or assume a move is valid before receiving confirmation from the backend.

All communication uses JSON messages containing a mandatory `type` field that identifies the event.

---

# Connection

## WebSocket Endpoint

```
ws://localhost:3500/ws
```

When a client establishes a connection, the server generates a unique user identifier.

### Server → Client

```json
{
    "type": "CONNECTED",
    "userId": "uuid"
}
```

The frontend should cache this identifier for the lifetime of the WebSocket connection.

---

# Protocol Events

---

# CONNECTED

Sent immediately after a successful WebSocket connection.

## Direction

```
Server → Client
```

### Payload

```json
{
    "type":"CONNECTED",
    "userId":"uuid"
}
```

---

# CREATE_ROOM

Creates a new multiplayer room.

The player creating the room automatically becomes the **White** player.

The room initially enters the **waiting** state until another player joins.

## Direction

```
Client → Server
```

### Request

```json
{
    "type":"CREATE_ROOM"
}
```

---

### Response

```
Server → Client
```

```json
{
    "type":"ROOM_CREATED",
    "roomId":"uuid",
    "inviteLink":"http://localhost:5173/join/<roomId>"
}
```

---

# ROOM_CREATED

Indicates that a room has been successfully created.

### Fields

| Field | Description |
|--------|-------------|
| roomId | Unique room identifier |
| inviteLink | Shareable invitation URL |

---

# JOIN_ROOM

Requests to join an existing room.

The server validates that:

- the room exists
- the room is not already active
- the room is not full

If successful, the joining player becomes the **Black** player.

## Direction

```
Client → Server
```

### Request

```json
{
    "type":"JOIN_ROOM",
    "roomId":"uuid"
}
```

---

# ROOM_JOINED

Broadcast to **both** connected players after the second player successfully joins.

## Direction

```
Server → All Players
```

### Payload

```json
{
    "type":"ROOM_JOINED",
    "roomId":"uuid",
    "players":[
        "whitePlayerId",
        "blackPlayerId"
    ],
    "whitePlayer":"uuid",
    "blackPlayer":"uuid",
    "gameStatus":"active",
    "fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "turn":0
}
```

---

### Fields

| Field | Description |
|--------|-------------|
| roomId | Unique room identifier |
| players | Connected player IDs |
| whitePlayer | White player's ID |
| blackPlayer | Black player's ID |
| gameStatus | waiting / active / over |
| fen | Current board state in Forsyth–Edwards Notation |
| turn | Side to move |

---

# MOVE

Requests the server to execute a chess move.

Clients transmit only the source and destination squares.

The backend performs every validation before updating the board.

Validation includes:

- Player ownership
- Turn validation
- Square validation
- Legal move generation
- Check detection
- Checkmate detection
- Draw detection
- Board update

## Direction

```
Client → Server
```

### Request

```json
{
    "type":"MOVE",
    "roomId":"uuid",
    "from":"e2",
    "to":"e4"
}
```

---

# CHESS_STATE

Sent after every successful move.

This represents the complete authoritative game state.

Clients should immediately synchronize their UI with this payload.

## Direction

```
Server → All Players
```

### Payload

```json
{
    "type":"CHESS_STATE",
    "fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "turn":1,
    "inCheck":false,
    "isOver":false,
    "result":{
        "status":"IN_PROGRESS",
        "winner":null,
        "hasWinner":false,
        "drawReason":"NO_DRAW_REASON"
    }
}
```

---

### Fields

| Field | Description |
|--------|-------------|
| fen | Current board position |
| turn | Player whose turn is next |
| inCheck | Indicates whether the current player is in check |
| isOver | Indicates whether the game has finished |
| result | Current game result |

---

# PLAYER_LEFT

Sent automatically when a player's WebSocket disconnects.

The remaining player can use this event to display a waiting screen or notify the user that the opponent has left.

Clients never send this event.

## Direction

```
Server → Remaining Player
```

### Payload

```json
{
    "type":"PLAYER_LEFT",
    "playerId":"uuid",
    "gameStatus":"waiting"
}
```

---

# ERROR

Returned whenever the requested action cannot be completed.

## Direction

```
Server → Client
```

### Payload

```json
{
    "type":"ERROR",
    "message":"Illegal move"
}
```

Possible error messages include:

- Illegal move
- Invalid squares
- Room not found
- Room is full
- Game already active
- Game is not active
- Unable to join room
- No room ID provided
- You are not a player in this room
- Not your turn

---

# Room Lifecycle

```
Client A
     │
     │ CREATE_ROOM
     ▼

Waiting Room

     │
     │ JOIN_ROOM
     ▼

ROOM_JOINED
(sent to both players)

     │

Game Active

     │
     │ MOVE
     ▼

CHESS_STATE

     │
     │ MOVE
     ▼

CHESS_STATE

     │
     │ ...

     ▼

Game Over
```

---

# Room States

A room can exist in one of three states.

## waiting

Only one player is present.

Additional players may join.

Moves are rejected.

---

## active

Two players are connected.

Moves are accepted.

The backend validates every move.

---

## over

The game has ended due to:

- Checkmate
- Draw
- Room cleanup

No additional moves are accepted.

---

# Turn Encoding

```
0 = White
1 = Black
```

The frontend should use this value to determine whose turn it is.

---

# Board Synchronization

The backend is the **single source of truth**.

Clients should never calculate future board positions independently.

Instead, they should:

1. Send a MOVE request.
2. Wait for CHESS_STATE.
3. Replace the current board with the received FEN.

This guarantees both players always remain synchronized.

---

# Server Responsibilities

The backend exclusively manages:

- WebSocket connections
- Room creation
- Room cleanup
- Player assignment
- Turn validation
- Chess move validation
- Legal move generation
- Check detection
- Checkmate detection
- Draw detection
- FEN generation
- Game state synchronization
- Broadcasting updated positions
- Disconnect handling

---

# Typical Game Flow

```
Client
    │
    ▼
CONNECT

    │
    ▼
CONNECTED

    │
    ▼
CREATE_ROOM

    │
    ▼
ROOM_CREATED

             Player 2
                 │
                 ▼
             JOIN_ROOM

                 │
                 ▼

ROOM_JOINED
(sent to both)

        │
        ▼
MOVE

        │
        ▼
CHESS_STATE

        │
        ▼
MOVE

        │
        ▼
CHESS_STATE

        │
        ▼
...

        │
        ▼
CHECKMATE / DRAW

        │
        ▼
Game Over
```

---

# Design Principle

The multiplayer architecture follows a **server-authoritative model**.

The backend owns the game.

The frontend only displays the current state and forwards user actions.

This prevents desynchronization, illegal moves, client-side cheating, and inconsistent board states while ensuring every connected player observes the exact same game state.