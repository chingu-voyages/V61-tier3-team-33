# Chess — Backend

Express + TypeScript backend for the Chess application. Handles REST API and real-time communication via Socket.IO.

## Tech Stack

- [Bun](https://bun.sh) — runtime, package manager, and test runner
- [Express](https://expressjs.com) — HTTP server
- [Socket.IO](https://socket.io) — real-time communication
- [TypeScript](https://www.typescriptlang.org) — type safety

## Getting Started

```bash
bun install
bun run dev
```

Server runs at `http://localhost:3001`.

## Commands

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `bun run dev`    | Start server with hot reload       |
| `bun run start`  | Start server without hot reload    |
| `bun run build`  | Build for production               |
| `bun test`       | Run tests                          |

## Project Structure

```
src/
├── config.ts      # Environment variables
├── index.ts       # Server entry point
└── index.test.ts  # Tests
```

## Environment Variables

Create a `.env` file in this directory to override defaults:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

## API

| Method | Route     | Description         |
| ------ | --------- | ------------------- |
| GET    | /health   | Health check        |
