"use client"

import type { PieceType, PieceColor } from "@/core/piece"
import { QUEEN, ROOK, BISHOP, KNIGHT } from "@/core/piece"
import { Position } from "@/core/position"
import { Board, Square } from "@/core/board"
import { getPieceIcon } from "../pieces"

const PROMOTION_PIECES: PieceType[] = [QUEEN, ROOK, BISHOP, KNIGHT]

interface PromotionOverlayProps {
  pendingPromotion: { from: Position; to: Position }
  board: Board
  boardFlipped: boolean
  onCancel: () => void
  onConfirm: (type: PieceType) => void
}

export function PromotionOverlay({
  pendingPromotion,
  board,
  boardFlipped,
  onCancel,
  onConfirm,
}: PromotionOverlayProps) {
  const promotionColor: PieceColor | null = Square.pieceColor(
    Board.at(board, pendingPromotion.from)
  )

  const gameColumn = boardFlipped
    ? 8 - Position.file(pendingPromotion.to)
    : Position.file(pendingPromotion.to) + 1

  const gameTargetRow = boardFlipped
    ? Position.rank(pendingPromotion.to) + 1
    : 8 - Position.rank(pendingPromotion.to)

  const anchoredAtTop = gameTargetRow === 1
  const style = {
    gridColumn: gameColumn,
    gridRow: anchoredAtTop ? "1 / 5" : "5 / 9",
  }

  if (promotionColor === null) return null

  return (
    <div
      className="absolute inset-0 z-10 grid"
      style={{
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
      }}
    >
      <div
        className="col-span-full row-span-full bg-black/40"
        onClick={onCancel}
      />
      <div
        className={`z-20 flex overflow-hidden rounded-md bg-card shadow-2xl ring-1 ring-black/10 ${anchoredAtTop ? "flex-col" : "flex-col-reverse"}`}
        style={style}
      >
        {PROMOTION_PIECES.map((type) => (
          <button
            key={type}
            onClick={() => onConfirm(type)}
            className="flex flex-1 cursor-pointer items-center justify-center border-b p-1.5 transition-colors last:border-b-0 hover:bg-accent"
          >
            {getPieceIcon(
              { type, color: promotionColor },
              { className: "size-full" }
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
