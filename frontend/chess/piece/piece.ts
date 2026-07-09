import type { Move } from "../core/move";
import type { PieceColor } from "../core/piece";
import type { Position } from "../core/position";
import type { BoardContext, MoveContext } from "../core/state";

import { Pawn } from "./pawn";
import { Rook } from "./rook";
import { King } from "./king";
import { Queen } from "./queen";
import { Bishop } from "./bishop";
import { Knight } from "./knight";

export interface IPiece {
  isAttacking(color: PieceColor, target: Position, ctx: BoardContext): boolean;
  attacks(attacks: Position[], from: Position, ctx: BoardContext): Position[];
  pseudoLegalMoves(moves: Move[], from: Position, ctx: MoveContext): Move[];
}

export interface IPieces {
  pawn: Pawn;
  knight: Knight;
  bishop: Bishop;
  rook: Rook;
  queen: Queen;
  king: King;
}
