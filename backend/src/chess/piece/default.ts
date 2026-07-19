import { Bishop } from "./bishop";
import { King } from "./king";
import { Knight } from "./knight";
import { Pawn } from "./pawn";
import type { IPieces } from "./piece";
import { Queen } from "./queen";
import { Rook } from "./rook";

const defaultPieces: IPieces = {
  pawn: new Pawn(),
  knight: new Knight(),
  bishop: new Bishop(),
  rook: new Rook(),
  queen: new Queen(),
  king: new King(),
};

/** Returns the default singleton instance holding all six piece types. */
export function getDefaultPieces(): IPieces {
  return defaultPieces;
}
