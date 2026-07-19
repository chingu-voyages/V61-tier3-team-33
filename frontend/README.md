# Chess — Frontend

Multiplayer chess client built with Next.js 16, React 19, and shadcn/ui. Renders the board, captures player input, and communicates with the authoritative backend over WebSocket.

- **Real-time play** — join rooms, make moves, request undos, send emotes
- **Local engine** — instant legal-move highlighting and piece dragging (authoritative state always from backend)
- **Matchmaking** — join or create rooms by mode and time control
- **Settings** — profile, appearance (board/piece themes), gameplay (sound), account
- **Dark/light mode** — theme toggle with system preference detection

## Prerequisites

- [Bun](https://bun.sh) 1.x

## Getting started

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `bun run dev`        | Start development server       |
| `bun run build`      | Production build               |
| `bun run start`      | Start production server        |
| `bun run lint`       | Run ESLint                     |
| `bun run format`     | Format with Prettier           |
| `bun run typecheck`  | TypeScript type-check          |
| `bun test`           | Run tests (116+ across 12 files) |

## Tech stack

- **[Next.js](https://nextjs.org)** 16 — App Router, React Server Components
- **[React](https://react.dev)** 19
- **[TypeScript](https://www.typescriptlang.org)** 6 — strict mode
- **[Tailwind CSS](https://tailwindcss.com)** 4
- **[shadcn/ui](https://ui.shadcn.com)** — component primitives
- **[@base-ui/react](https://base-ui.com)** — headless UI primitives
- **[@tabler/icons-react](https://tabler.io/icons)** — icons
- **[Motion](https://motion.dev)** — animations (emotes, transitions)
- **[next-themes](https://github.com/pacocoursey/next-themes)** — dark/light mode
- **[Bun test](https://bun.sh/docs/cli/test)** + **[Happy DOM](https://github.com/capricorn86/happy-dom)** — testing
- **[Testing Library](https://testing-library.com)** — component tests

## Features

- **Chess board** — 8×8 grid with piece SVGs, legal-move highlights, piece dragging
- **Clock display** — real-time countdown for both players (white/black)
- **Emotes** — tray with 6 reactions, animated overlay on opponent's emote
- **Undo handshake** — request/accept/decline with timed window
- **Room management** — join by invite link, auto-rejoin on reconnect, leave
- **Grace indicators** — shows when opponent disconnects/reconnects
- **Matchmaking** — waiting queue, room creation with configurable time controls
- **Settings** — 4 panels: profile (username, avatar), appearance (board/piece theme), gameplay (sound), account (session info, sign out)
- **Debug panel** — raw socket command composer and event log for development
- **Sound effects** — move, capture, and other game audio cues
- **Responsive** — desktop sidebar layout, mobile sheet navigation
- **Persistent session** — player identity and theme preferences stored in localStorage

## Project structure

```
app/                Next.js App Router pages and layouts
├── layout.tsx      Root layout (fonts, globals, AppProvider)
├── page.tsx        Home page
├── globals.css     Global Tailwind styles
└── (shell)/        Shell layout (sidebar, header)
    ├── layout.tsx
    ├── page.tsx
    └── play/
        └── page.tsx    Play/multiplayer screen

components/         React UI components
├── board/          Chess board — Board, BoardSquare, ClockDisplay, EmoteTray, EmoteOverlay,
│                   PromotionOverlay, View, helpers
├── pieces/         SVG chess piece rendering (by type + color)
├── play/           Matchmaking — PlayScreen, MatchSearch, TimeControl, RoomInvite, play-reducer
├── main/           App shell — AppHeader, AppSidebar, MainPage
├── settings/       Settings — 4 panels (Profile, Appearance, Gameplay, Account), desktop/mobile layouts
├── debug/          Developer panel — Composer, QuickSend, log Entry, Status, reducer
└── ui/             shadcn/ui primitives — button, card, dialog, dropdown, sidebar, toast, tooltip, …

context/            React context providers
├── app/            Root provider — nests all other providers in order
├── session/        WebSocket session identity (handshake, token persistence in localStorage)
├── room/           Room lifecycle — join, leave, game started/ended, undo flow, grace, clock expiry
├── theme/          Site theme (light/dark via next-themes) + chess board/piece theme (persisted)
└── settings/       Settings UI navigation state (active section, mobile view)

socket/             WebSocket client and protocol
├── client.ts       Raw WebSocket wrapper — lifecycle states, exponential backoff reconnection
├── provider.tsx    React integration via useSyncExternalStore
├── events.ts       Server→Client event type definitions (room:joined, move:made, undo:*, emote:received, …)
├── commands.ts     Client→Server command builders (handshake, joinRoom, makeMove, requestUndo, sendEmote, …)
├── types.ts        Shared socket types — Lifecycle, Mode, GameSnapshot, ClockState, GameOutcome, HandshakeReply
├── errors.ts       Error codes, categorized sets (ROOM_RESET_CODES, TOKEN_INVALID_CODES), user-facing messages
├── use-event.ts    useSocketEvent hook — type-safe subscription to server events
├── use-action.ts   useGameActions hook — memoized command dispatchers for all game actions
└── fake.ts         FakeSocket — simulated WebSocket for tests

chess/              Duplicated from backend/src/chess — enables offline AI play on desktop
│                   without a server round-trip. The backend is always authoritative
│                   in multiplayer; the local engine provides instant feedback.
├── index.ts        Chess store — public API (snapshot, subscribe, makeMove, select, …)
├── context.ts      ChessContext + useChess() hook
├── provider.tsx    ChessProvider — listens to socket events, drives the store
├── core/           Core types and primitives
│   ├── board.ts    8×8 grid representation
│   ├── brand.ts    Branded type utility
│   ├── fen.ts      FEN-related types
│   ├── game.ts     GameResult, GameStatus, DrawReason
│   ├── hash.ts     Zobrist hash type
│   ├── history.ts  Move history with snapshots
│   ├── move.ts     Move type, MoveType enum
│   ├── piece.ts    Piece, PieceColor, PieceType
│   ├── position.ts Position (branded 0–63), square constants A1–H8
│   ├── reason.ts   EndReason branded type
│   ├── state.ts    ChessState (board + hash + metadata)
│   └── theme.ts    Board theme definitions
├── engine/         Move generation and application
│   ├── engine.ts   IEngine interface
│   ├── default.ts  Default engine implementation
│   ├── move.ts     Legal move generation
│   ├── apply.ts    Apply a move to the board
│   ├── undo.ts     Undo a move
│   ├── attack.ts   Attack detection (is square attacked?)
│   └── psuedo.ts   Pseudo-legal move generation
├── fen/            FEN string parser/serializer
│   ├── decode.ts   FEN → board state
│   ├── encode.ts   Board state → FEN
│   └── index.ts    Re-exports
├── piece/          Per-piece-type move generators
│   ├── piece.ts    IPiece interface
│   ├── default.ts  Default implementation factory
│   ├── pawn.ts, knight.ts, bishop.ts, rook.ts, queen.ts, king.ts
├── rules/          Game rule evaluation
│   ├── rules.ts    IRules interface
│   ├── default.ts  Check/checkmate/stalemate/draw detection
│   └── index.ts    Re-exports
├── hasher/         Zobrist hashing
│   ├── hasher.ts   IHasher interface
│   ├── default.ts  Default hasher
│   ├── zobrist.ts  Zobrist hash table computation
│   └── index.ts    Re-exports
└── tracker/        Position repetition tracking
    ├── tracker.ts  ITracker interface
    ├── default.ts  In-memory tracker
    ├── position.ts Position-count map
    └── index.ts    Re-exports

hooks/              Shared React hooks
├── use-clock.ts    Real-time chess clock countdown (requestAnimationFrame)
└── use-mobile.ts   Responsive breakpoint detection via useSyncExternalStore

audio/              Sound system — client (playback), context/provider (React integration), fake (test mock)
config/             Environment configuration (NEXT_PUBLIC_SOCKET_URL)
lib/                Utilities — cn (Tailwind class merger), retry (exponential backoff with jitter)
public/             Static assets
```

## Architecture

### Provider hierarchy

Providers are nested inside `AppProvider` in this order (inner providers can consume outer contexts):

```
AppProvider (root)
├── ThemeProvider (next-themes — dark/light site theme, D hotkey)
├── ChessThemeProvider (board colors, piece set — persisted in localStorage)
├── TooltipProvider
├── AudioProvider (sound effects — move, capture, etc.)
├── SocketProvider (WebSocket connection state — connecting/open/closed/reconnecting/failed)
├── SessionProvider (player identity — sends handshake on connect, stores token)
├── RoomProvider (room lifecycle — listens to all room/game/undo/clock/grace events)
└── ChessProvider (board state — listens to move/position/undo events, drives the chess store)
```

### Data flow

```
Player taps a square
  → BoardSquare.onClick
    → ChessProvider.select(position)
      → ChessStore.select(position)
        → chess.legalMovesFrom(position) — local engine for instant feedback
          → component re-renders with highlighted legal destinations

Player taps a destination
  → BoardSquare.onClick
    → ChessProvider.makeMove(from, to)
      → ChessStore.makeMove(from, to)
        → socket.send({ type: "move:make", from, to, promoteTo? })
          → backend validates + applies move
            → backend broadcasts move:made to both occupants
              → ChessProvider receives move:made event
                → ChessStore.applyMove(snapshot)
                  → replaces board with authoritative FEN from server
                    → component re-renders with new position
```

The local chess engine provides **instant feedback** (legal move highlighting, piece dragging preview) but the authoritative state always comes from the backend. After every `move:make`, the client replaces its board with the server's snapshot — if `move:rejected` arrives instead, the client's board was never modified.

### Socket lifecycle

```
closed → connecting → open → (reconnecting → open) → closed
                            → failed
```

The `SocketClient` manages reconnection with exponential backoff. On `open`, `SessionProvider` sends `session:handshake` with the stored token to resume the session. Room state is guarded against stale events (late-arriving notifications from a previous room are discarded).

## Environment Variables

Create a `.env` file in the frontend directory:

```env
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3500/ws
```
