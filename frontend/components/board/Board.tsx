import { Board as TBoard, Square } from "@/core/board"
import { Position } from "@/core/position"
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
      />
    )
  }
  return (
    <div className="aspect-square h-full max-h-[80vh] max-w-full min-h-72 min-w-72">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {squares}
      </div>
    </div>
  )
}
