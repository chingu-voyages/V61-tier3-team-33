# Chess — Backend

Authoritative multiplayer chess server. Owns all game logic, validation, state transitions, and room lifecycle. Clients render the board and forward player actions — they never compute positions locally.

- **REST API** — auth (register/login/logout with email or Google), health check
- **WebSocket** — real-time multiplayer chess protocol with session resume, undo handshake, grace period, clock management, and emotes
- **Chess engine** — in-house move generation, FEN parsing, Zobrist hashing, repetition detection

## Tech Stack

- [Bun](https://bun.sh) — runtime, package manager, and test runner
- [Elysia](https://elysiajs.com) — HTTP + WebSocket server
- [TypeScript](https://www.typescriptlang.org) — strict mode, branded types
- [Chess](src/chess/) — in-house chess engine (move generation, validation, FEN)

## Getting Started

```bash
bun install
bun run dev
```

Server runs at `http://localhost:3500`.

## Commands

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `bun run dev`    | Start server with hot reload       |
| `bun run start`  | Start server without hot reload    |
| `bun run build`  | Build for production               |
| `bun test`       | Run tests (1590+ across 63 files)  |
| `bun run lint`   | Run ESLint                         |
| `bun run format` | Format with Prettier               |
| `bun run typecheck` | TypeScript type-check           |

## Features

- **Authoritative game state** — server validates every move, clients are rendering terminals
- **Session resume** — reconnect with a token and pick up where you left off
- **Undo handshake** — request, accept, decline, cancel, timeout with consent manager
- **Grace period** — disconnected players get a window to reconnect before forfeit
- **Chess clock** — multiple time-control strategies (bullet, blitz, rapid, etc.)
- **Emotes** — send reactions to your opponent with cooldown
- **Room lifecycle** — join, leave, rejoin, matchmaking via waiting queue
- **Event bus (Hub)** — pub/sub with FAST (sync) and DEFERRED (macrotask) lanes

## Project Structure

```
src/
├── index.ts         # Server entry point
├── server/
│   ├── types/       # Branded primitives and shared domain types
│   ├── protocol/    # Wire message shapes — commands, events, replies, errors
│   ├── codec/       # Codec interface + JsonCodec (swappable wire format)
│   ├── events/      # Mediator (command router) + Hub (pub/sub event bus)
│   ├── clock/       # Time-control strategies (clock.ts, timer.ts, factory.ts, move/, match/)
│   ├── game/        # Chess match — engine, occupant slots, lifecycle (WAITING→ACTIVE→FINISHED)
│   ├── occupant/    # Player seat abstraction (Human sends events over WebSocket)
│   ├── session/     # Socket↔player binding, token-based resume/reconnect
│   ├── services/    # Thin command classes — game (join, leave, move, undo, resign, sync, select),
│   │                # emote (send), connection (identify, close, pong)
│   ├── store/       # In-memory data stores — GameStore (games + waiting queue), SessionStore (triple-indexed)
│   ├── transport/   # Gateway (Elysia WS server, composition root), Connections (socket lifecycle)
│   ├── util/        # Grace timer, three-phase room switch (RoomSwitcher), consent manager, retry, mutex
│   ├── http/        # HTTP auth routes (register, login, logout, Google OAuth)
│   ├── players/     # Player profile stores (name, rating, stats)
│   └── auth/        # Identity — authentication, auth tokens, Google OAuth
├── chess/           # Chess engine core — move gen, FEN, Zobrist hashing, rules, tracking
│   ├── chess.ts     Chess class (orchestrator — config, move, undo, state)
│   ├── config.ts    Engine configuration
│   ├── errors.ts    Chess-specific errors (IllegalMoveError, FENError, NothingToUndoError)
│   ├── core/        Branded types: Piece, Position, Move, GameResult, …
│   ├── engine/      Legal move generation, apply/undo, attack detection
│   ├── hasher/      Zobrist hashing for position identification
│   ├── history/     Move stack with snapshots (supports undo)
│   ├── parser/      FEN decode/encode
│   ├── piece/       Per-piece-type move generators (pawn, knight, bishop, rook, queen, king)
│   ├── rules/       Check/checkmate/stalemate/draw rule evaluation
│   └── tracker/     Position repetition tracking (threefold repetition)
└── logging/         # App logger and bus-backed event log
```

## Architecture

The server uses a **Mediator + command-class** architecture with an event bus for internal communication:

```
WebSocket → Gateway → Codec.decode → Mediator.switch → Service.run → Game → Hub.emit → Occupant.notify → ws.send
```

1. **Gateway** (Elysia transport) receives raw WebSocket messages
2. **Codec** deserialises and validates into typed `Command` objects
3. **Mediator** routes by command type — no monolithic service, just a switch + delegation
4. **Service commands** are single-responsibility classes (e.g. `MoveCommand.run()`, `JoinCommand.run()`)
5. **Game** mutates chess state and emits events
6. **Hub** (pub/sub) broadcasts events to subscribers (FAST = sync, DEFERRED = macrotask)
7. **Occupant** delivers notifications to each player's WebSocket

No `GameService` god-class — each operation is independently testable.

### Key design choices

| Principle | Implementation |
|---|---|
| **Server-authoritative** | Clients never compute positions — every `move:made` carries the full snapshot |
| **Parse, don't validate** | `Codec.decode` fully validates input; past decode, no re-checking |
| **Interface-based injection** | `Codec`, `SessionStore`, `GameStore`, `Publisher`, `Occupant`, `Clock` — all swapped at the composition root |
| **Event-driven internals** | Game emits events without knowing who listens; Mediator subscribes for side effects |
| **Result types over exceptions** | `Result<T, E>` discriminated union for every fallible operation |
| **Branded types** | `Lifecycle`, `Mode`, `Position`, `PieceColor` — branded to prevent type confusion |

## Documentation

| File | Description |
| ---- | ----------- |
| [docs/server.md](docs/server.md) | Full architecture, module dependencies, protocol reference, extensibility seams, design principles |
| [docs/chess.md](docs/chess.md) | Chess engine API — class reference, types, configuration, FEN support |

## Environment Variables

Create a `.env` file in this directory to override defaults:

```env
PORT=3500
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GOOGLE_CLIENT_ID=
```

## Endpoints

### REST

| Method | Route             | Description              |
| ------ | ----------------- | ------------------------ |
| GET    | /health           | Health check             |
| POST   | /auth/register    | Register with email      |
| POST   | /auth/login       | Login with email/password|
| POST   | /auth/google      | Login with Google        |
| POST   | /auth/logout      | Logout                   |

### WebSocket

| Endpoint          | Description                    |
| ----------------- | ------------------------------ |
| ws://localhost:3500/ws | Real-time game protocol   |
