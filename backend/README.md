# Chess — Backend

Elysia + TypeScript backend for the Chess application. Handles REST API and WebSocket real-time communication.

## Tech Stack

- [Bun](https://bun.sh) — runtime, package manager, and test runner
- [Elysia](https://elysiajs.com) — HTTP + WebSocket server
- [TypeScript](https://www.typescriptlang.org) — type safety

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

## Project Structure

```
src/server/
├── types/           # Branded primitives (PieceColor, Move, GameSnapshot, etc.)
├── protocol/        # Wire message shapes — commands, events, replies, errors
├── codec/           # Codec interface + JsonCodec (swappable wire format)
├── bus/             # In-process pub/sub (Hub) with priority lanes
├── clock/           # Time-control strategies and running timer
├── game/            # Chess match — game rules, lifecycle, occupant slots
├── occupant/        # Player seat abstraction (Human)
├── session/         # Socket↔player binding, reconnect
├── services/        # Orchestration — GameService routes commands to the right game
├── transport/       # Gateway (composition root), Connections (socket lifecycle)
├── util/            # Grace timer, async retry with backoff, mutex
├── http/            # HTTP auth routes
├── players/         # Player profile stores
└── auth/            # Identity — authentication, auth tokens, Google OAuth

src/
├── logging/         # App logger and bus-backed event log
├── chess/           # Chess engine core
└── index.ts         # Server entry point
```

## Architecture

See [docs/server.md](docs/server.md) for the full architecture, module map, data flow, protocol reference, extensibility seams, and design principles.

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
