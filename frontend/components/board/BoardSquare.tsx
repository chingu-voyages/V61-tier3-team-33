import { Piece, PieceColor, WHITE } from "@/core/piece"
import { cn } from "@/lib/utils"
import { Activity, memo, useCallback } from "react"
import { getPieceIcon } from "../pieces"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence } from "motion/react"
import type { Position } from "@/core/position"

const BORDERED_STATES = {
  selected: "selected",
  lastMove: "last-move",
  legalCapture: "capture",
  check: "check",
  illegal: "illegal",
  premove: "premove",
} as const

const compoundVariants = (
  Object.entries(BORDERED_STATES) as [keyof typeof BORDERED_STATES, string][]
).flatMap(([state, slug]) => [
  {
    tone: "light" as const,
    state,
    class: `border-chess-${slug}-border-on-light`,
  },
  {
    tone: "dark" as const,
    state,
    class: `border-chess-${slug}-border-on-dark`,
  },
])

export const squareVariants = cva("relative h-full w-full", {
  variants: {
    tone: {
      light: "bg-chess-light-square",
      dark: "bg-chess-dark-square",
    },
    state: {
      none: "",
      selected: "border-2 bg-chess-selected-fill",
      lastMove: "bg-chess-last-move-fill",
      legalMove: "", // dot rendered separately, piece-color-aware
      legalCapture: "border-2 bg-chess-capture-fill",
      check: "border-2 bg-chess-check-fill",
      illegal: "border-2 bg-chess-illegal-fill",
      premove: "border-2 bg-chess-premove-fill",
    },
  },
  compoundVariants,
  defaultVariants: {
    tone: "light",
    state: "none",
  },
})

export type SquareVariants = VariantProps<typeof squareVariants>

export function squareHoverClass(): string {
  return "hover:bg-chess-hover-fill"
}

interface BoardSquareProps {
  position: Position
  piece: Piece | null
  isDark: boolean
  state?: SquareVariants["state"]
  movingPieceColor?: PieceColor
  onSquareClick: (pos: Position) => void
  isLastMoveTo?: boolean
}

function BoardSquareImpl({
  position,
  piece,
  isDark,
  state = "none",
  movingPieceColor,
  onSquareClick,
  isLastMoveTo = false,
}: BoardSquareProps) {
  const tone = isDark ? "dark" : "light"
  const dotFillClass =
    movingPieceColor === WHITE ? "bg-chess-w-fill" : "bg-chess-b-fill"

  // Stable per-square callback — onSquareClick itself is a stable reference
  // from the parent, so this only changes if the square's own position does
  // (i.e. never, since position is fixed for a given square instance).
  const handleClick = useCallback(() => onSquareClick(position), [onSquareClick, position])

  return (
    <div
      className={cn(
        squareVariants({ tone, state }),
        squareHoverClass(),
        "aspect-square"
      )}
      onClick={handleClick}
    >
      <AnimatePresence>
        {piece && (
          <motion.div
            key={`${piece.color}-${piece.type}`}
            initial={{ scale: isLastMoveTo ? 1.08 : 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.12, ease: "easeOut" } }}
            transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.6 }}
          >
            {getPieceIcon(piece, { className: "w-full h-full" })}
          </motion.div>
        )}
      </AnimatePresence>
      <Activity mode={state === "legalMove" ? "visible" : "hidden"}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn("h-1/3 w-1/3 rounded-full", dotFillClass)} />
        </div>
      </Activity>
    </div>
  )
}

function areEqual(prev: BoardSquareProps, next: BoardSquareProps): boolean {
  return (
    prev.position === next.position &&
    prev.isDark === next.isDark &&
    prev.state === next.state &&
    prev.movingPieceColor === next.movingPieceColor &&
    prev.onSquareClick === next.onSquareClick &&
    prev.isLastMoveTo === next.isLastMoveTo &&
    prev.piece?.type === next.piece?.type &&
    prev.piece?.color === next.piece?.color
  )
}

// Memoized: a move only changes ~2-4 squares (from/to, plus previous
// selection/legal-move highlights), so re-rendering all 64 on every state
// update was the main cost behind the long-task warnings on move apply.
export const BoardSquare = memo(BoardSquareImpl, areEqual)
