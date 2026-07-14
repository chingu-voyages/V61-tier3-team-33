import { Board as TBoard, Square, StateConfig } from "@/core/board"
import { Position } from "@/core/position"
import { BoardSquare } from "./BoardSquare"

interface BoardView extends StateConfig {
  flipped: boolean
}

interface BoardProps {
  board: TBoard
  view: BoardView
  onSquareClick: (pos: Position) => void
}

export function Board({ board, view, onSquareClick }: BoardProps) {
  const movingPieceColor =
    view.selected !== null
      ? Square.decode(TBoard.at(board, view.selected))?.color
      : undefined

  const squares: React.ReactNode[] = []
  for (const { value, position } of TBoard.squares(board)) {
    const state = Square.toVariant(Square.state(position, board, view))
    squares.push(
      <BoardSquare
        key={Position.index(position)}
        position={position}
        piece={Square.decode(value)}
        isDark={Position.isDarkSquare(position)}
        state={state}
        movingPieceColor={movingPieceColor}
        onSquareClick={onSquareClick}
      />
    )
  }

  return (
    <div className="grid h-full w-full grid-cols-8 grid-rows-8">
      {view.flipped ? squares.toReversed() : squares}
    </div>
  )
}
