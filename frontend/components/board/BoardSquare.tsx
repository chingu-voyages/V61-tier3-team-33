import { memo } from "react"
import { Piece, PieceColor, WHITE } from "@/core/piece"
import { cn } from "@/lib/utils"
import { getPieceIcon } from "../pieces"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence } from "motion/react"
import type { Position } from "@/core/position"

const squareVariants = cva(
  "relative aspect-square h-full w-full hover:bg-chess-hover-fill",
  {
    variants: {
      tone: {
        light: "bg-chess-light-square",
        dark: "bg-chess-dark-square",
      },
      state: {
        none: "",
        selected:
          "border-2 border-chess-selected-border-on-light bg-chess-selected-fill dark:border-chess-selected-border-on-dark",
        lastMove: "bg-chess-last-move-fill",
        legalMove: "",
        legalCapture:
          "border-2 border-chess-capture-border-on-light bg-chess-capture-fill dark:border-chess-capture-border-on-dark",
        check:
          "border-2 border-chess-check-border-on-light bg-chess-check-fill dark:border-chess-check-border-on-dark",
        illegal:
          "border-2 border-chess-illegal-border-on-light bg-chess-illegal-fill dark:border-chess-illegal-border-on-dark",
        premove:
          "border-2 border-chess-premove-border-on-light bg-chess-premove-fill dark:border-chess-premove-border-on-dark",
      },
    },
    defaultVariants: {
      tone: "light",
      state: "none",
    },
  }
)

type SquareVariant = VariantProps<typeof squareVariants>

interface BoardSquareProps {
  position: Position
  piece: Piece | null
  isDark: boolean
  state?: Exclude<SquareVariant["state"], undefined>
  movingPieceColor?: PieceColor
  onSquareClick: (pos: Position) => void
}

function arePropsEqual(prev: BoardSquareProps, next: BoardSquareProps) {
  if (prev.position !== next.position) return false
  if (prev.isDark !== next.isDark) return false
  if (prev.state !== next.state) return false
  if (prev.movingPieceColor !== next.movingPieceColor) return false
  if (prev.onSquareClick !== next.onSquareClick) return false

  const p = prev.piece
  const n = next.piece
  if (p === n) return true
  if (p === null || n === null) return false
  return p.type === n.type && p.color === n.color
}

const BoardSquare = memo(function BoardSquare({
  position,
  piece,
  isDark,
  state = "none",
  movingPieceColor,
  onSquareClick,
}: BoardSquareProps) {
  const tone = isDark ? "dark" : "light"
  const dotFillClass =
    movingPieceColor === WHITE ? "bg-chess-w-fill" : "bg-chess-b-fill"

  return (
    <div
      data-slot="board-square"
      className={cn(squareVariants({ tone, state }))}
      onClick={() => onSquareClick(position)}
    >
      <AnimatePresence>
        {piece && (
          <motion.div
            key={`${piece.color}-${piece.type}`}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              scale: 0.9,
              opacity: 0,
              transition: { duration: 0.12, ease: "easeOut" },
            }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 32,
              mass: 0.6,
            }}
          >
            {getPieceIcon(piece, { className: "w-full h-full" })}
          </motion.div>
        )}
      </AnimatePresence>
      {state === "legalMove" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn("h-1/3 w-1/3 rounded-full", dotFillClass)} />
        </div>
      )}
    </div>
  )
}, arePropsEqual)

export { BoardSquare }
