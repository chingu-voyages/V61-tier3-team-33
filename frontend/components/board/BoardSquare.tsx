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
  /** The local player's color — pieces of any other color can't be picked up. */
  myColor?: PieceColor
  /** True for the square a piece is currently being dragged out of. */
  isDragSource?: boolean
  /** True for the square currently under the pointer during a drag. */
  isDragHover?: boolean
  /** True for the square a dragged piece just landed on — skips the
   * mount-in animation since the floating drag piece already "carried" it
   * there visually. */
  justArrived?: boolean
  onSquareClick: (pos: Position) => void
  onPiecePointerDown?: (
    e: React.PointerEvent,
    position: Position,
    piece: Piece
  ) => void
  onPieceDragMove?: (e: React.PointerEvent) => void
  onPieceDragEnd?: (e: React.PointerEvent) => void
}

function arePropsEqual(prev: BoardSquareProps, next: BoardSquareProps) {
  if (prev.position !== next.position) return false
  if (prev.isDark !== next.isDark) return false
  if (prev.state !== next.state) return false
  if (prev.movingPieceColor !== next.movingPieceColor) return false
  if (prev.myColor !== next.myColor) return false
  if (prev.isDragSource !== next.isDragSource) return false
  if (prev.isDragHover !== next.isDragHover) return false
  if (prev.justArrived !== next.justArrived) return false
  if (prev.onSquareClick !== next.onSquareClick) return false
  if (prev.onPiecePointerDown !== next.onPiecePointerDown) return false
  if (prev.onPieceDragMove !== next.onPieceDragMove) return false
  if (prev.onPieceDragEnd !== next.onPieceDragEnd) return false

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
  myColor,
  isDragSource = false,
  isDragHover = false,
  justArrived = false,
  onSquareClick,
  onPiecePointerDown,
  onPieceDragMove,
  onPieceDragEnd,
}: BoardSquareProps) {
  const tone = isDark ? "dark" : "light"
  const dotFillClass =
    movingPieceColor === WHITE ? "bg-chess-w-fill" : "bg-chess-b-fill"

  function handlePointerDown(e: React.PointerEvent) {
    if (!piece) return
    // Can't pick up the opponent's pieces — mirrors chess.com: only your
    // own pieces lift off the board under the pointer.
    if (myColor !== undefined && piece.color !== myColor) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    onPiecePointerDown?.(e, position, piece)
  }

  return (
    <div
      data-slot="board-square"
      className={cn(squareVariants({ tone, state }))}
      onClick={() => onSquareClick(position)}
    >
      {/* Opacity toggles independently of the motion.div's own animated
          opacity below — the two compose by multiplication, so this cleanly
          hides the static piece while it's being dragged without touching
          (or fighting) the enter/exit animation. */}
      <div
        className="absolute inset-0"
        style={isDragSource ? { opacity: 0 } : undefined}
      >
        <AnimatePresence>
          {piece && (
            <motion.div
              key={`${piece.color}-${piece.type}`}
              initial={justArrived ? false : { scale: 1.08, opacity: 0 }}
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
              className="h-full w-full"
            >
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={onPieceDragMove}
                onPointerUp={onPieceDragEnd}
                onPointerCancel={onPieceDragEnd}
                className="h-full w-full touch-none cursor-grab select-none active:cursor-grabbing"
              >
                {getPieceIcon(piece, { className: "h-full w-full" })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {isDragHover && (
        <div className="border-chess-selected-border-on-light dark:border-chess-selected-border-on-dark pointer-events-none absolute inset-0 border-2" />
      )}
      {state === "legalMove" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={cn("h-1/3 w-1/3 rounded-full", dotFillClass)} />
        </div>
      )}
    </div>
  )
}, arePropsEqual)

export { BoardSquare }
