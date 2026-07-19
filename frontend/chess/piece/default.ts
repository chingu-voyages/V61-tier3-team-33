import type { IPieces } from "./piece"
import { Pawn } from "./pawn"
import { Rook } from "./rook"
import { King } from "./king"
import { Queen } from "./queen"
import { Bishop } from "./bishop"
import { Knight } from "./knight"

const defaultPieces: IPieces = {
  pawn: new Pawn(),
  knight: new Knight(),
  bishop: new Bishop(),
  rook: new Rook(),
  queen: new Queen(),
  king: new King(),
}

export function getDefaultPieces(): IPieces {
  return defaultPieces
}
