# Chingu Chess

A real-time multiplayer online chess game with server-authoritative game logic, WebSocket communication, and a rich React frontend. Built as a [Chingu](https://chingu.io) Voyage 61 project.

## Overview

Chess is a full-stack chess platform where two players can face off in real time. The backend owns every move validation, state transition, and room lifecycle — clients are rendering terminals that display the board and forward player actions. The server handles session management, undo handshakes, grace periods for disconnects, chess clocks with multiple time controls, and even emote reactions between opponents.

The frontend is built with Next.js 16 and provides instant local feedback (legal move highlighting, piece dragging previews) while always deferring to the authoritative server state for actual moves. An in-house chess engine powers both the client and server, and the client-side copy enables future offline AI play on desktop.

## Features

### Gameplay
- **Real-time multiplayer** — join or create rooms, play standard chess against another human
- **Authoritative server** — all move validation and game state lives on the backend; clients never compute positions locally for multiplayer
- **Chess clocks** — multiple time-control formats (bullet, blitz, rapid, etc.) with real-time countdown displayed for both players
- **Legal move highlighting** — click a piece to see all legal destinations (computed locally for instant feedback, confirmed by server)
- **Pawn promotion** — overlay prompts the player to choose a piece type when a pawn reaches the eighth rank
- **Resign** — concede the game at any time
- **State sync** — request a full game snapshot on reconnection to catch up

### Undo System
- **Undo request** — ask your opponent to take back the last move
- **Accept / decline** — opponent can approve or reject the request
- **Cancel** — withdraw your request before the opponent responds
- **Expiry** — undo requests time out after a window if unanswered
- **Invalidation** — pending undo is automatically invalidated when a new move is made

### Connection & Reliability
- **Session resume** — reconnect with a stored token and pick up exactly where you left off
- **Grace period** — when a player disconnects mid-game, a timer starts; reconnect before it expires and play resumes (opponent sees a grace indicator)
- **Grace cancelled / expired** — visual notification when the opponent returns or forfeits

### Social
- **Emotes** — send 👍 😅 🤔 🎉 😤 ⚡ to your opponent (per-player per-game cooldown, animated overlay on receipt)
- **Room invites** — shareable room links for direct challenges
- **Matchmaking** — waiting queue pairs players by game mode and time control

### Appearance
- **Dark / light mode** — theme toggle with system preference detection and a keyboard shortcut (D)
- **Board themes** — multiple color schemes for the chess board squares
- **Piece sets** — switch between different piece icon styles
- **Settings panels** — four sections: Profile (username, avatar), Appearance (board, pieces), Gameplay (sound), Account (session info, sign out)

### Developer
- **Debug panel** — collapsible overlay with raw socket command composer, quick-send buttons for common commands, and a real-time event log
- **Socket status indicator** — shows connection state (connecting, open, reconnecting, failed) and attempt count

### Persistence
- **Session token** — player identity and auth token persisted in localStorage across page reloads
- **Theme preferences** — board theme, piece set, and dark/light mode remembered between sessions
- **Room rejoin** — automatically rejoin the active room after page refresh or reconnection

### Audio
- **Sound effects** — audio cues for moves, captures, and other game events (toggleable in settings)

## Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| [Bun](https://bun.sh) | Runtime, package manager, test runner |
| [Elysia](https://elysiajs.com) | HTTP + WebSocket server |
| [TypeScript](https://www.typescriptlang.org) | Strict mode, branded types |
| In-house chess engine | Move generation, FEN parsing, Zobrist hashing, repetition detection |

### Frontend

| Technology | Purpose |
|---|---|
| [Next.js](https://nextjs.org) 16 | App Router, React Server Components |
| [React](https://react.dev) 19 | UI framework |
| [TypeScript](https://www.typescriptlang.org) 6 | Strict mode |
| [Tailwind CSS](https://tailwindcss.com) 4 | Styling |
| [shadcn/ui](https://ui.shadcn.com) | Component primitives |
| [Motion](https://motion.dev) | Animations |
| In-house chess engine | Local move highlighting, future offline AI play |

## Architecture

```
┌──────────────┐         WebSocket          ┌──────────────┐
│   Frontend   │ ◄──────────────────────►   │   Backend    │
│  Next.js 16  │   JSON messages (type)     │  Elysia + Bun│
│  React 19    │                            │  Mediator +  │
│  Tailwind 4  │                            │  Command cls │
└──────────────┘                            └──────────────┘
```

**Backend:** A Mediator pattern routes incoming WebSocket commands to thin, single-responsibility service classes. An event bus (Hub) decouples producers from consumers — the Game emits events without knowing who listens, and the Mediator subscribes for cross-cutting side effects (grace periods, clock expiry, undo invalidation).

**Frontend:** React context providers nest in a defined order (Theme → Audio → Socket → Session → Room → Chess). The local chess engine provides instant feedback for legal move highlighting, but the authoritative state always comes from the backend via `move:made` events.

See [backend/docs/server.md](backend/docs/server.md) for the full protocol reference and architecture deep-dive.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.x

### Backend

```bash
cd backend
bun install
bun run dev
```

Server runs at `http://localhost:3500`.

### Frontend

```bash
cd frontend
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Create `backend/.env` (optional overrides):

```env
PORT=3500
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GOOGLE_CLIENT_ID=
```

Create `frontend/.env`:

```env
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3500/ws
```

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for full project structure, directory maps, and architecture details of each package.

## Running Tests

```bash
# Backend (1590+ tests)
cd backend && bun test

# Frontend (116+ tests)
cd frontend && bun test
```

## API Endpoints

### REST (Backend)

| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Health check |
| POST | /auth/register | Register with email/password |
| POST | /auth/login | Login with email/password |
| POST | /auth/google | Login with Google |
| POST | /auth/logout | Logout |

### WebSocket (Backend)

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:3500/ws` | Real-time game protocol |

See [backend/docs/server.md](backend/docs/server.md) for the full WebSocket protocol reference, including all command and event message shapes.

## Extensibility

The architecture is designed with explicit seams for adding features without modifying existing game logic. New capabilities slot in via the Mediator command router, Hub event subscriptions, and thin command classes.

| Extension | How |
|---|---|
| **Chat system** | Add `chat:send` command + `chat:received` event + `ChatSendCommand` class. Wire in Mediator switch. See [server.md#adding-a-new-command](backend/docs/server.md#adding-a-new-command) |
| **AI opponent** | Implement an `Occupant` that generates moves via the chess engine. Register it in the game factory |
| **Spectator mode** | Subscribe to Hub events for a room; send notifications to read-only WebSocket connections |
| **Replay viewer** | Log every `move:made` event through a Hub `onAny` subscriber; replay from stored history |
| **Tournament bracket** | Create a `TournamentService` that listens for `game:ended` events and advances bracket state |
| **Persistent storage** | Implement `GameReader`/`GameWriter` and `SessionReader`/`SessionWriter` against Redis or Postgres |
| **Rate limiting** | Add a `RateLimiter` utility and apply per-command in the Mediator |
| **New clock formats** | Implement the `Clock` interface + register in `clock/factory.ts` |
| **New wire formats** | Implement the `Codec` interface (e.g. MsgPack) and swap at the composition root |

See [backend/docs/server.md#extensibility](backend/docs/server.md#extensibility) for step-by-step implementation guides for each extension point.

## Team

- **Yangchen Dema** (Scrum Master) — [GitHub](https://github.com/dema66) · [LinkedIn](https://www.linkedin.com/in/yangchendema/)
- **Michael Okoro** (Product Owner) — [GitHub](https://github.com/Michael-Okoro) · [LinkedIn](https://www.linkedin.com/in/michaelcokoro/)
- **Sabrina Shuss** (Shadow Scrum Master) — [GitHub](https://github.com/sabrinadshuss) · [LinkedIn](https://www.linkedin.com/in/sabrinashuss/)
- **Emad Faheem** (UI/UX Designer) — [GitHub](https://github.com/emadgfy) · [LinkedIn](https://www.linkedin.com/in/emadfaheem/)
- **Ndzana Christophe** (Developer) — [GitHub](https://github.com/christoban) · [LinkedIn](https://www.linkedin.com/in/christophe-ndzana-6951a4316/)
- **Ali Ahmed** (Developer) — [GitHub](https://github.com/7-Dany) · [LinkedIn](https://www.linkedin.com/in/ali-ahmed-036b54216/)
- **Kartik Sharma** (Developer) — [GitHub](https://github.com/Kartik-619) · [LinkedIn](https://www.linkedin.com/in/kartik-sharma-9069852b6/)

## Contributing

This is a Chingu Voyage project. Team members can contribute by:

1. Forking the repo and creating a feature branch from `development`
2. Making changes and running `bun run lint` + `bun run typecheck` + `bun test` in the relevant package
3. Opening a pull request against the `development` branch
4. Tagging a reviewer from the team

## Team Documents

- [Team Project Ideas](./docs/team_project_ideas.md)
- [Team Decision Log](./docs/team_decision_log.md)
