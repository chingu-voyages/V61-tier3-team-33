import { Piece, PieceColor, WHITE } from "@/core/piece"
import { cn } from "@/lib/utils"
import { Activity } from "react"
import { getPieceIcon } from "../pieces"
import { cva, type VariantProps } from "class-variance-authority"

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
  piece: Piece | null
  isDark: boolean
  state?: SquareVariants["state"]
  movingPieceColor?: PieceColor
  onClick?: () => void
}

export function BoardSquare({
  piece,
  isDark,
  state = "none",
  movingPieceColor,
  onClick,
}: BoardSquareProps) {
  const tone = isDark ? "dark" : "light"
  const dotFillClass =
    movingPieceColor === WHITE ? "bg-chess-w-fill" : "bg-chess-b-fill"

  return (
    <div
      className={cn(
        squareVariants({ tone, state }),
        squareHoverClass(),
        "aspect-square"
      )}
      onClick={onClick}
    >
      <Activity mode={piece ? "visible" : "hidden"}>
        {piece && getPieceIcon(piece, { className: "w-full h-full" })}
      </Activity>
      <Activity mode={state === "legalMove" ? "visible" : "hidden"}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn("h-1/3 w-1/3 rounded-full", dotFillClass)} />
        </div>
      </Activity>
    </div>
  )
}
