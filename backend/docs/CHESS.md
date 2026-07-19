# Chess Module

Rules engine and game orchestrator for standard chess.

## Quick Start

```ts
import { Chess, E2, E4, WHITE, CHECKMATE } from "../chess";

const game = new Chess();

// Play e4
game.moveTo(E2, E4);

// Check the board
game.pieceAt(E4); // { type: PAWN, color: WHITE }
game.sideToMove(); // BLACK
game.toFen(); // "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

// Check game state
game.isInCheck(); // false
game.isOver(); // false
game.gameResult().status; // IN_PROGRESS
```

## Chess Class

### Constructor

```ts
new Chess()                // Standard starting position
new Chess({ fen: "..." }) // Custom FEN position
```

The constructor accepts a `ChessConfig` object with optional fields. All default to sensible implementations if omitted.

### Static Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `Chess.isValidSquare(sq)` | `boolean` | Validates an algebraic notation string (e.g. `"e4"`, `"H1"`) |

### Position Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `pieceAt(square)` | `Piece \| null` | Piece on the given square, or `null` if empty |
| `sideToMove()` | `PieceColor` | `WHITE` or `BLACK` |
| `isInCheck()` | `boolean` | Whether the side to move is in check |
| `isOver()` | `boolean` | Whether the game has ended (checkmate or draw) |
| `gameResult()` | `GameResult` | Full result: status, winner, draw reason |
| `kingPosition(color)` | `Position` | Board position of the given color's king |
| `lastMove()` | `Move \| null` | Most recently played move |
| `halfMoveClock()` | `number` | Moves since last pawn move or capture (for 50-move rule) |

### Legal Move Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `legalMovesFrom(from)` | `Move[]` | All legal moves for the piece on `from` |
| `legalMovesMap()` | `Map<Position, Position[]>` | Every from-square mapped to its legal destinations |
| `isLegalSquare(from, to)` | `boolean` | Whether `from→to` is legal (Position args) |
| `isLegalMove(from, to)` | `boolean` | Whether `from→to` is legal (string args, e.g. `"e2"`, `"e4"`) |
| `legalPromotions(from, to)` | `PieceType[]` | Piece types available for promotion on this move |

### Making Moves

```ts
// Simple — find and apply in one call
const move = game.moveTo(E2, E4);
const move = game.moveTo(A7, A8, KNIGHT); // promotion

// Advanced — find first, apply second
const legal = game.legalMovesFrom(E2).find(m => m.to === E4)!;
game.makeMove(legal);
```

| Method | Returns | Throws | Description |
|--------|---------|--------|-------------|
| `moveTo(from, to, promoteTo?)` | `Move` | `IllegalMoveError` | Find + apply in one call. Defaults promotion to QUEEN |
| `makeMove(move)` | `Move` | `IllegalMoveError` | Apply a pre-built `Move` object |

### Undo

```ts
game.undoMove(); // reverts last move, returns it
game.canUndo();  // false before any moves, true after
```

| Method | Returns | Throws | Description |
|--------|---------|--------|-------------|
| `undoMove()` | `Move` | `NothingToUndoError` | Reverts the last move |
| `canUndo()` | `boolean` | — | Whether there is a move to undo |

### History & State

| Method | Returns | Description |
|--------|---------|-------------|
| `plyCount()` | `number` | Half-moves played so far |
| `moveHistory()` | `Move[]` | All moves, oldest first |
| `toFen()` | `string` | Current position as FEN |
| `state()` | `ChessState` | Serializable snapshot (board + hash + metadata) |
| `getContext()` | `TurnContext` | Deep copy of the internal board context |
| `getHash()` | `bigint` | Zobrist hash of the current position |

## Types

### Position

A branded `number` (0–63) representing a board square. Encoded as `file * 8 + rank`.

```ts
import { Position, E2, E4 } from "../chess";

Position.parse("e4");  // 35 (or null for invalid input)
Position.toString(E4); // "e4"
```

Square constants `A1` through `H8` are exported for convenience:

```ts
import { A1, B1, C1, D1, E1, F1, G1, H1 } from "../chess";
```

### Piece

```ts
interface Piece {
  type: PieceType;  // PAWN | KNIGHT | BISHOP | ROOK | QUEEN | KING
  color: PieceColor; // WHITE | BLACK
}
```

### Move

```ts
interface Move {
  piece: Piece;
  from: Position;
  to: Position;
  type: MoveType;            // NORMAL | CASTLING | EN_PASSANT | PROMOTION
  promoteTo: PieceType | null; // null unless type === PROMOTION
  captured: Piece | null;      // null unless this is a capture
}
```

### GameResult

```ts
interface GameResult {
  status: GameStatus;   // IN_PROGRESS | CHECKMATE | DRAW
  winner: PieceColor;   // meaningful only when hasWinner is true
  hasWinner: boolean;
  drawReason: DrawReason; // meaningful only when status is DRAW
}
```

### ChessState

Serializable snapshot returned by `game.state()`:

```ts
interface ChessState extends TurnContext {
  hash: bigint; // Zobrist hash
}
```

## Constants

### Piece Types

`PAWN`, `KNIGHT`, `BISHOP`, `ROOK`, `QUEEN`, `KING`

### Colors

`WHITE`, `BLACK`

### Move Types

`NORMAL`, `CASTLING`, `EN_PASSANT`, `PROMOTION`

### Game Status

`IN_PROGRESS`, `CHECKMATE`, `DRAW`

### Draw Reasons

`NO_DRAW_REASON`, `STALEMATE`, `THREEFOLD_REPETITION`, `FIFTY_MOVE_RULE`, `INSUFFICIENT_MATERIAL`

### Positions

`A1` through `H8` (64 constants), plus `FILE_A`–`FILE_H`, `RANK_1`–`RANK_8`, and `NO_POSITION`.

## Errors

All errors extend `Error`.

| Error | When |
|-------|------|
| `FENError` | Invalid FEN string passed to constructor |
| `IllegalMoveError` | `moveTo` or `makeMove` called with an illegal move |
| `InvalidSquareError` | (Reserved) Invalid square string |
| `NothingToUndoError` | `undoMove` called with empty history |

## FEN Support

The module reads and writes standard FEN strings. The starting position is exported as `STARTING_FEN`:

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

Load any position:

```ts
const game = new Chess({
  fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
});
```

## Configuration

```ts
interface ChessConfig {
  fen?: string;      // Starting FEN (default: STARTING_FEN)
  engine?: IEngine;  // Move generation engine
  hasher?: IHasher;  // Zobrist hasher
  rules?: IRules;    // Draw/checkmate rules
  parser?: IParser;  // FEN parser/encoder
  tracker?: ITracker; // Repetition tracker
  history?: IHistory; // Move history store
}
```

All fields are optional. Omit any to get the default in-memory implementation. Swap `history` for a persistent store (e.g. Redis) to survive server restarts.

## Architecture

```
Chess (orchestrator)
 ├── Engine    — pseudo-legal move generation + legality checks
 ├── Hasher    — incremental Zobrist hashing
 ├── Rules     — checkmate, stalemate, repetition, 50-move, insufficient material
 ├── Parser    — FEN decode/encode
 ├── Tracker   — position repetition counting
 └── History   — move stack with snapshots for undo
```

The `Chess` class coordinates all subsystems. Internal calls follow a strict ordering: apply → hash → track → history. Do not interleave direct engine calls with `makeMove`/`undoMove` or the subsystems will desync.
