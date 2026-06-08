# Chess — Frontend

React + TypeScript frontend for the Chess application. Connects to the backend via REST and Socket.IO for real-time gameplay.

## Tech Stack

- [React 19](https://react.dev) — UI
- [Vite 8](https://vite.dev) — dev server and bundler
- [TypeScript](https://www.typescriptlang.org) — type safety
- [Socket.IO Client](https://socket.io) — real-time connection to backend
- [Bun](https://bun.sh) — package manager and test runner

## Getting Started

```bash
bun install
bun run dev
```

App runs at `http://localhost:5173`. Backend must be running at `http://localhost:3001`.

## Commands

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `bun run dev`     | Start dev server with HMR          |
| `bun run build`   | Type-check and build for production|
| `bun run preview` | Preview the production build       |
| `bun run lint`    | Run ESLint                         |
| `bun run typecheck` | Run TypeScript type-check only   |
| `bun test`        | Run tests                          |

## Project Structure

```
src/
├── App.tsx        # Root component
├── main.tsx       # Entry point
└── index.css      # Global styles
```

## Testing

Tests live alongside source files as `*.test.tsx`. Run with:

```bash
bun test
```

Uses `bun:test` (built-in) with `react-dom/server` for component rendering assertions. No extra test framework needed.

## Environment Variables

Create a `.env` file in this directory to override defaults:

```env
VITE_API_URL=http://localhost:3001
```
