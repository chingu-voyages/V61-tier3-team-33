"use client"

import { useEffect, useState } from "react"

import { Board as TBoard, Square } from "@/lib/core/board"
import { Position, RANK_1, RANK_8 } from "@/lib/core/position"
import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  type Piece,
  type PieceColor,
  type PieceType,
} from "@/lib/core/piece"
import { useGameActions } from "@/socket/game-actions"
import { useSocketEvent } from "@/socket/use-socket-event"
import { POSITION_ACCEPTED, POSITION_REJECTED } from "@/socket/incoming"
import { BoardSquare, type SquareVariant } from "./BoardSquare"
import { getPieceIcon } from "../pieces"

// Underpromotion is rare but legal, so all four choices are offered —
// always in this order, nearest-to-destination first (see the placement
// math in the picker below).
const PROMOTION_CHOICES: PieceType[] = [QUEEN, ROOK, BISHOP, KNIGHT]

const PROMOTION_LABELS: Record<number, string> = {
  [QUEEN]: "Queen",
  [ROOK]: "Rook",
  [BISHOP]: "Bishop",
  [KNIGHT]: "Knight",
}

interface BoardProps {
  board: TBoard
  /** Whose move it is, from GameState.turn. Null before a game exists —
   * selection is disabled in that case (see the guard below). */
  turn: PieceColor | null
  /** This client's seat, from GameState.color. */
  color: PieceColor | null
  /** From GameState.isCheck. isCheck always describes `turn` — the side
   * to move next — regardless of what kind of move (normal, castle, en
   * passant, promotion) produced it, so no move-type inspection is
   * needed to know whose king to flag. */
  isCheck: boolean
}

// How long a rejected position:select/move flashes "illegal" before
// fading back to the square's normal appearance.
const ILLEGAL_FLASH_MS = 400

/**
 * Owns the click-a-piece selection flow: clicking a square sends
 * position:select; the server's position:accept/reject reply drives which
 * squares render as selected/legal/capture/illegal. Clicking a square
 * that's already a legal destination sends move:make instead of
 * re-selecting.
 *
 * This is local UI state, not game state — GameProvider/useGame owns the
 * authoritative position (the `board` prop), so a selection here never
 * outlives the board it was made against (see the effect below).
 */
export function Board({ board, turn, color, isCheck }: BoardProps) {
  const actions = useGameActions()

  const [selected, setSelected] = useState<Position | null>(null)
  const [legalMoves, setLegalMoves] = useState<Position[]>([])
  const [illegal, setIllegal] = useState<Position | null>(null)
  // Set instead of immediately sending move:make when the chosen
  // destination is a pawn reaching the last rank — holds the move until
  // the player picks a piece from the overlay below.
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Position
    to: Position
    color: PieceColor
  } | null>(null)

  // A new board reference means a fresh position — join, sync, undo, or
  // the opponent's move all replace `board` wholesale. Whatever was
  // selected against the old position no longer applies. This resets
  // during render (React's "adjust state when a prop changes" pattern,
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in
  // an effect, so the stale selection is never painted and there's no
  // extra cascading render.
  const [prevBoard, setPrevBoard] = useState(board)
  if (board !== prevBoard) {
    setPrevBoard(board)
    setSelected(null)
    setLegalMoves([])
    setPendingPromotion(null)
  }

  useSocketEvent(POSITION_ACCEPTED, (msg) => {
    setSelected(msg.position)
    setLegalMoves(msg.moves)
    setIllegal(null)
  })

  useSocketEvent(POSITION_REJECTED, (msg) => {
    setSelected(null)
    setLegalMoves([])
    setIllegal(msg.position)
  })

  useEffect(() => {
    if (illegal === null) return
    const id = setTimeout(() => setIllegal(null), ILLEGAL_FLASH_MS)
    return () => clearTimeout(id)
  }, [illegal])

  function handleSquareClick(position: Position, piece: ReturnType<typeof Square.decode>) {
    if (selected !== null && legalMoves.includes(position)) {
      const movingPiece = Square.decode(TBoard.at(board, selected))
      const promotionRank = movingPiece?.color === WHITE ? RANK_8 : RANK_1
      const isPromotion =
        movingPiece?.type === PAWN && Position.rank(position) === promotionRank

      if (isPromotion && movingPiece) {
        setPendingPromotion({ from: selected, to: position, color: movingPiece.color })
        setSelected(null)
        setLegalMoves([])
        return
      }

      actions.makeMove({ from: selected, to: position })
      setSelected(null)
      setLegalMoves([])
      return
    }

    if (selected === position) {
      setSelected(null)
      setLegalMoves([])
      return
    }

    // The board already knows these three things without asking the
    // server, so don't round-trip a position:select that can only ever
    // come back rejected:
    //  - an empty square has nothing to select
    if (piece === null) return
    //  - it isn't a piece you can move this turn
    if (turn !== null && turn !== color) return
    //  - it isn't your piece to begin with
    if (piece.color !== color) return

    actions.selectPosition(position)
  }

  function choosePromotion(promoteTo: PieceType) {
    if (!pendingPromotion) return
    actions.makeMove({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promoteTo,
    })
    setPendingPromotion(null)
  }

  // The king to flag red — the side to move (`turn`) is who `isCheck`
  // describes. Scanning the board rather than trusting move.from/to keeps
  // this correct for every move type, including castling and en passant,
  // where the checking piece isn't the one that just moved.
  let checkedKing: Position | null = null
  if (isCheck && turn !== null) {
    for (const { value, position } of TBoard.squares(board)) {
      const piece = Square.decode(value)
      if (piece && piece.type === KING && piece.color === turn) {
        checkedKing = position
        break
      }
    }
  }

  const squares: React.ReactNode[] = []
  for (const { value, position } of TBoard.squares(board)) {
    const piece = Square.decode(value)
    const isLegalMove = legalMoves.includes(position)

    const variant: SquareVariant =
      illegal === position
        ? "illegal"
        : checkedKing === position
          ? "check"
          : selected === position
            ? "selected"
            : isLegalMove
              ? piece
                ? "capture"
                : "legal"
              : "default"

    squares.push(
      <BoardSquare
        key={Position.index(position)}
        piece={piece}
        isDark={Position.isDarkSquare(position)}
        variant={variant}
        onClick={() => handleSquareClick(position, piece)}
      />,
    )
  }
  return (
    <div className="aspect-square w-full max-w-160">
      <div className="relative grid h-full w-full grid-cols-8 grid-rows-8">
        {squares}

        {pendingPromotion && (
          <PromotionPicker
            to={pendingPromotion.to}
            color={pendingPromotion.color}
            onChoose={choosePromotion}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>
    </div>
  )
}

interface PromotionPickerProps {
  to: Position
  color: PieceColor
  onChoose: (type: PieceType) => void
  onCancel: () => void
}

/**
 * Overlay for choosing a promotion piece, anchored to the destination
 * file. The four choices stack from the destination square toward the
 * middle of the board (the only direction that stays on-board), so
 * they're always adjacent to the pawn that's promoting.
 */
function PromotionPicker({ to, color, onChoose, onCancel }: PromotionPickerProps) {
  const col = Position.file(to)
  const destRow = 7 - Position.rank(to)
  const direction = destRow === 0 ? 1 : -1

  return (
    <>
      {/* Clicking anywhere outside the choices cancels the promotion
       * without sending a move. Sits above the squares (blocking other
       * clicks while a choice is pending) and below the choices. */}
      <div
        className="absolute inset-0 z-20 bg-black/40"
        onClick={onCancel}
      />

      {PROMOTION_CHOICES.map((type, i) => {
        const row = destRow + direction * i
        const piece: Piece = { type, color }

        return (
          <button
            key={type}
            type="button"
            aria-label={`Promote to ${PROMOTION_LABELS[type]}`}
            className="absolute z-30 flex items-center justify-center bg-white shadow-lg transition-colors hover:bg-neutral-100"
            style={{
              left: `${(col / 8) * 100}%`,
              top: `${(row / 8) * 100}%`,
              width: "12.5%",
              height: "12.5%",
            }}
            onClick={() => onChoose(type)}
          >
            {getPieceIcon(piece, { className: "h-full w-full" })}
          </button>
        )
      })}
    </>
  )
}
