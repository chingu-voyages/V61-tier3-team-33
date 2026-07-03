import { Piece } from "@/lib/core/piece"
import { cn } from "@/lib/utils"
import { Activity } from "react"
import { getPieceIcon } from "../pieces"

/**
 * Visual state of a single square, driven by the click-a-piece selection
 * flow (position:select -> position:accept/reject) plus move outcomes:
 *  - "default": no selection involves this square.
 *  - "selected": the currently selected piece's square.
 *  - "legal": an empty square the selected piece can move to.
 *  - "capture": an occupied square the selected piece can move to.
 *  - "illegal": a just-rejected position:select or move, flashed briefly.
 */
export type SquareVariant = "default" | "selected" | "legal" | "capture" | "illegal" | "check"

interface BoardSquareProps {
  piece: Piece | null
  isDark: boolean
  variant?: SquareVariant
  onClick?: () => void
}

export function BoardSquare({
  piece,
  isDark,
  variant = "default",
  onClick,
}: BoardSquareProps) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden transition-colors duration-150",
        isDark ? "bg-[#b58863]" : "bg-[#f0d9b5]",
        variant === "selected" && "bg-yellow-400/60",
        variant === "illegal" && "bg-red-500/60",
        variant === "check" && "bg-red-600/70",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <Activity mode={piece ? "visible" : "hidden"}>
        {piece && getPieceIcon(piece, { className: "relative z-10 w-full h-full" })}
      </Activity>

      {/* King in check: solid red tint (above) plus a pulsing ring so it
       * reads clearly even though the piece icon covers most of the
       * square. */}
      <Activity mode={variant === "check" ? "visible" : "hidden"}>
        <div className="pointer-events-none absolute inset-0 animate-pulse ring-[6px] ring-inset ring-red-500" />
      </Activity>

      {/* Empty legal-move square: a soft dot, same as the old `highlight`. */}
      <Activity mode={variant === "legal" ? "visible" : "hidden"}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-1/3 w-1/3 rounded-full bg-black/20" />
        </div>
      </Activity>

      {/* Occupied legal-move square: a ring around the capturable piece. */}
      <Activity mode={variant === "capture" ? "visible" : "hidden"}>
        <div className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-red-600/70" />
      </Activity>
    </div>
  )
}
