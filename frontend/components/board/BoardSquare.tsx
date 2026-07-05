import { Piece } from "@/core/piece"
import { cn } from "@/lib/utils"
import { Activity } from "react"
import { getPieceIcon } from "../pieces"

interface BoardSquareProps {
  piece: Piece | null
  isDark: boolean
  highlight?: boolean
  onClick?: () => void
}

export function BoardSquare({
  piece,
  isDark,
  highlight,
  onClick,
}: BoardSquareProps) {
  return (
    <div
      className={cn(
        "relative h-full w-full",
        isDark ? "bg-[#b58863]" : "bg-[#f0d9b5]"
      )}
      onClick={onClick}
    >
      <Activity mode={piece ? "visible" : "hidden"}>
        {piece && getPieceIcon(piece, { className: "w-full h-full" })}
      </Activity>
      <Activity mode={highlight ? "visible" : "hidden"}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-1/3 w-1/3 rounded-full bg-black/20" />
        </div>
      </Activity>
    </div>
  )
}
