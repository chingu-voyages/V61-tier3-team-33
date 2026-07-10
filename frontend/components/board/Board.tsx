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
  // Board component renders a standard chessboard.
  // Promotion overlays are rendered by the parent in a separate
  // absolutely-positioned layer — see View.tsx's .relative container.

  const movingPieceColor = view.selected !== null
    ? Square.decode(TBoard.at(board, view.selected))?.color
    : undefined

  let squares: React.ReactNode[] = []
  for (const { value, position } of TBoard.squares(board)) {
    const state = Square.toVariant(Square.state(position, board, view))
    squares.push(
      <BoardSquare
        key={Position.index(position)}
        piece={Square.decode(value)}
        isDark={Position.isDarkSquare(position)}
        state={state}
        movingPieceColor={movingPieceColor}
        onClick={() => onSquareClick(position)}
      />
    )
  }
  if (view.flipped) {
    squares = squares.reverse()
  }
  return (
    <div className="aspect-square h-full max-h-[80vh] max-w-full min-h-72 min-w-72">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {squares}
      </div>
    </div>
  )
}
