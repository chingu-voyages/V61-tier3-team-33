# Chess — Frontend

Chess application frontend built with [Next.js](https://nextjs.org) 16, React 19, and [shadcn/ui](https://ui.shadcn.com).

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
| `bun test`           | Run tests                      |

## Tech stack

- **[Next.js](https://nextjs.org)** 16 — App Router, React Server Components
- **[React](https://react.dev)** 19
- **[TypeScript](https://www.typescriptlang.org)** 6
- **[Tailwind CSS](https://tailwindcss.com)** 4
- **[shadcn/ui](https://ui.shadcn.com)** — component primitives
- **[@base-ui/react](https://base-ui.com)** — headless UI primitives
- **[@tabler/icons-react](https://tabler.io/icons)** — icons
- **[Motion](https://motion.dev)** — animations
- **[next-themes](https://github.com/pacocoursey/next-themes)** — dark/light mode
- **[Bun test](https://bun.sh/docs/cli/test)** + **[Happy DOM](https://github.com/capricorn86/happy-dom)** — testing

## Project structure

```
app/                App Router pages and layouts
├── layout.tsx      Root layout (fonts, globals, AppProvider)
├── page.tsx        Home page
├── globals.css     Global Tailwind styles
└── (shell)/        Shell layout (sidebar, header)
    ├── layout.tsx
    ├── page.tsx
    └── play/
        └── page.tsx    Play/multiplayer screen

components/         React UI components
├── board/          Chess board (Board, BoardSquare, ClockDisplay, EmoteTray, EmoteOverlay, View)
├── pieces/         SVG chess piece rendering
├── play/           Matchmaking, room lobby, time controls
├── main/           App shell (AppHeader, AppSidebar, MainPage)
├── settings/       Settings panels (Profile, Appearance, Gameplay, Account)
├── debug/          Developer debug panel (Composer, QuickSend, log viewer)
└── ui/             shadcn/ui primitives (button, card, dialog, dropdown, sidebar, toast, …)

context/            React context providers
├── app/            Root provider — nests all other providers
├── session/        WebSocket session identity (handshake, token persistence)
├── room/           Room lifecycle (join, leave, game started/ended, undo, grace, clock)
├── theme/          Site theme (light/dark) + chess board/piece theme
└── settings/       Settings UI navigation state

socket/             WebSocket client and protocol
├── client.ts       Raw WebSocket wrapper with reconnection
├── provider.tsx    React integration via useSyncExternalStore
├── events.ts       Server→Client event types and constants
├── commands.ts     Client→Server command builders
├── types.ts        Shared socket types (Lifecycle, GameSnapshot, ClockState, …)
├── errors.ts       Error codes, categorized code sets, error messages
├── use-event.ts    useSocketEvent hook (type-safe event subscription)
├── use-action.ts   useGameActions hook (typed command dispatchers)
└── fake.ts         FakeSocket for testing

chess/              Pure chess logic (no React dependency)
├── index.ts        Chess store — public API (snapshot, subscribe, makeMove, select, …)
├── context.ts      ChessContext + useChess() hook
├── provider.tsx    ChessProvider — listens to socket events, drives the store
├── core/           Core types: Board, Piece, Move, Position, FEN, GameResult, hash, theme
├── engine/         Move generation (pseudo-legal → legal), apply/undo, attack detection
├── fen/            FEN string parser/serializer
├── piece/          Per-piece-type move generators (pawn, knight, bishop, rook, queen, king)
├── rules/          Check/checkmate/stalemate detection, game result computation
├── hasher/         Zobrist hashing for position repetition detection
└── tracker/        Position repetition tracker (threefold repetition)

hooks/              Shared React hooks
├── use-clock.ts    Real-time chess clock countdown
└── use-mobile.ts   Responsive breakpoint detection

audio/              Sound system (client, context, provider, fake for testing)
config/             Environment configuration
lib/                Utilities (cn Tailwind class merger, retry with backoff)
public/             Static assets
```

## Architecture

### Provider hierarchy

```
AppProvider
├── ThemeProvider (next-themes: dark/light)
├── ChessThemeProvider (board colors, piece set)
├── TooltipProvider
├── AudioProvider (sound effects)
├── SocketProvider (WebSocket connection state)
├── SessionProvider (player identity, handshake)
├── RoomProvider (room lifecycle, undo, grace)
└── ChessProvider (board state, move orchestration)
```

### Data flow

```
Player clicks square
  → ChessProvider.select(position)
    → ChessStore.select(position) — computes legal moves from local engine
      → highlights legal destinations on board

Player clicks destination
  → ChessProvider.makeMove(from, to)
    → ChessStore.makeMove(from, to)
      → send({ type: "move:make", from, to }) via socket
        → backend validates + applies move
          → backend broadcasts move:made event
            → ChessProvider receives move:made
              → ChessStore.applyMove(snapshot) — replaces board with authoritative FEN
                → re-render with new position
```

The local chess engine is used for **instant feedback** (legal move highlighting, piece dragging) but the authoritative state always comes from the backend. After every `move:make`, the client waits for `move:made` and replaces its board with the server's snapshot.
