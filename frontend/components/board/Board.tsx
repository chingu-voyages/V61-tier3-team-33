import { Board as TBoard, Square } from "@/lib/core/board"
import { Position } from "@/lib/core/position"
import { BoardSquare } from "./BoardSquare"

interface BoardProps {
  board: TBoard
}

export function Board({ board }: BoardProps) {
  const squares: React.ReactNode[] = []
  for (const { value, position } of TBoard.squares(board)) {
    squares.push(
      <BoardSquare
        key={Position.index(position)}
        piece={Square.decode(value)}
        isDark={Position.isDarkSquare(position)}
      />,
    )
  }
  return (
    <div className="aspect-square w-full max-w-160">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {squares}
      </div>
    </div>
  )
}
