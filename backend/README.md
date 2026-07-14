# Chess — Backend

Elysia + TypeScript backend for the Chess application. Handles REST API and WebSocket real-time communication.

## Tech Stack

- [Bun](https://bun.sh) — runtime, package manager, and test runner
- [Elysia](https://elysiajs.com) — HTTP + WebSocket server
- [TypeScript](https://www.typescriptlang.org) — type safety
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
| `bun test`       | Run tests                          |
| `bun run lint`   | Run ESLint                         |
| `bun run format` | Format with Prettier               |
| `bun run typecheck` | TypeScript type-check           |

## Project Structure

```
src/
├── index.ts         # Server entry point
├── server/
│   ├── types/       # Branded primitives (PieceColor, Move, GameSnapshot, etc.)
│   ├── protocol/    # Wire message shapes — commands, events, replies, errors
│   ├── codec/       # Codec interface + JsonCodec (swappable wire format)
│   ├── events/      # Mediator (command router) + Hub (pub/sub event bus)
│   ├── clock/       # Time-control strategies and running timer
│   ├── game/        # Chess match — game rules, lifecycle, occupant slots
│   ├── occupant/    # Player seat abstraction (Human)
│   ├── session/     # Socket↔player binding, reconnect
│   ├── services/    # Command classes — game (join/move/undo/resign/…), emote, connection
│   ├── store/       # Data stores — GameStore (games + queue), SessionStore
│   ├── transport/   # Gateway (composition root), Connections (socket lifecycle)
│   ├── util/        # Grace timer, three-phase room switch, consent manager, retry, mutex
│   ├── http/        # HTTP auth routes
│   ├── players/     # Player profile stores
│   └── auth/        # Identity — authentication, auth tokens, Google OAuth
├── chess/           # Chess engine core (move generation, FEN, Zobrist hashing)
└── logging/         # App logger and bus-backed event log
```

## Architecture

The server uses a **Mediator + command-class** architecture:

1. WebSocket messages arrive at the **Gateway** (Elysia transport)
2. Messages are decoded by the **Codec** and validated
3. The **Mediator** routes each command by type to a handler method
4. Handler methods delegate to **thin command classes** in `services/`
5. Command classes mutate **Game** state and emit events through the **Hub**
6. The **Hub** (pub/sub) delivers events to player **Occupants** via WebSocket

No monolithic `GameService` — each operation is a single-responsibility class.

See [docs/server.md](docs/server.md) for the full architecture, protocol reference, extensibility seams, and design principles.

## Documentation

| File | Description |
| ---- | ----------- |
| [docs/server.md](docs/server.md) | Full server architecture, protocol reference, extensibility |
| [docs/chess.md](docs/chess.md) | Chess engine API reference |

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
