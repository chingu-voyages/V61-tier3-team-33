"use client"

import { useCallback, useState, useMemo, useRef, useEffect } from "react"
import { useRoom } from "@/context/room/context"
import { useChess } from "@/chess/context"
import { Board } from "@/components/board/Board"
import { WHITE, BLACK, QUEEN, ROOK, BISHOP, KNIGHT } from "@/core/piece"
import type { PieceType, PieceColor } from "@/core/piece"
import { Position } from "@/core/position"
import { Board as ChessBoard, Square } from "@/core/board"
import { useSoundContext } from "@/audio/context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IconFlipHorizontal,
  IconArrowBackUp,
  IconFlag,
  IconCrown,
  IconX,
} from "@tabler/icons-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ClockDisplay } from "@/components/board/ClockDisplay"
import { getPieceIcon } from "../pieces"
import { FINISHED } from "@/socket/types"
import { DRAW } from "@/core/game"
import { Reason } from "@/core/reason"

interface ViewProps {
  onLeave: () => void
}

export function View({ onLeave }: ViewProps) {
  const { state, actions } = useRoom()
  const { state: chessState, makeMove, select, confirmPromotion, cancelPromotion } = useChess()
  const [flipped, setFlipped] = useState(false)
  const [showResign, setShowResign] = useState(false)
  const { prime: primeAudio, preload: preloadAudio, playMove, playCapture } = useSoundContext()
  const lastPlayedSeq = useRef<number>(0)
  const prevBoardRef = useRef(chessState.board)

  // Preload sounds early to avoid deferred-play race between moves.
  useEffect(() => {
    preloadAudio()
  }, [preloadAudio])

  useEffect(() => {
    // Monotonic counter — integer comparison avoids re-render ambiguity.
    if (chessState.moveSeq === lastPlayedSeq.current) {
      prevBoardRef.current = chessState.board
      return
    }
    lastPlayedSeq.current = chessState.moveSeq
    const move = chessState.lastMove
    if (move) {
      const wasCapture = Square.decode(ChessBoard.at(prevBoardRef.current, move.to)) !== null
      if (wasCapture) playCapture()
      else playMove()
    }
    prevBoardRef.current = chessState.board
  }, [chessState.moveSeq, chessState.lastMove, chessState.board, playMove, playCapture])

  const onSquareClickRef = useRef<(pos: Position) => void>(() => {})
  useEffect(() => {
    onSquareClickRef.current = (pos: Position) => {
      primeAudio()
      if (state.status === FINISHED) return
      if (chessState.pendingPromotion) {
        cancelPromotion()
        return
      }
      if (chessState.selected !== null && chessState.legalMoves.includes(pos)) {
        makeMove(chessState.selected, pos)
        return
      }
      select(pos)
    }
  })
  // Stable ref — avoids re-rendering Board's memoized squares on every move.
  const onSquareClick = useCallback((pos: Position) => onSquareClickRef.current(pos), [])

  const promotionColor: PieceColor | null = chessState.pendingPromotion
    ? Square.pieceColor(ChessBoard.at(chessState.board, chessState.pendingPromotion.from))
    : null

  const PROMOTION_PIECES: PieceType[] = [QUEEN, ROOK, BISHOP, KNIGHT]

  const confirmResign = useCallback(() => {
    setShowResign(false)
    actions.resign()
  }, [actions])

  const isFinished = state.status === FINISHED && state.result !== null

  const resultText = useMemo(() => {
    if (!state.result || state.color === null) return ""
    const { hasWinner, winner, status, drawReason } = state.result
    if (hasWinner) {
      const iWon = winner === state.color
      return iWon ? "You won!" : "Opponent won!"
    }
    if (status === DRAW) {
      return Reason.drawLabel(drawReason)
    }
    return "Game Over"
  }, [state.result, state.color])

  if (state.color === null) return null

  const myColor = state.color
  const oppColor = myColor === WHITE ? BLACK : WHITE
  const baseFlipped = state.color === BLACK
  const boardFlipped = baseFlipped !== flipped

  const promotionColumn = chessState.pendingPromotion
    ? (boardFlipped ? 8 - Position.file(chessState.pendingPromotion.to) : Position.file(chessState.pendingPromotion.to) + 1)
    : undefined

  const promotionTargetRow = chessState.pendingPromotion
    ? (boardFlipped ? Position.rank(chessState.pendingPromotion.to) + 1 : 8 - Position.rank(chessState.pendingPromotion.to))
    : undefined

  // Anchors on promotion square, extends 4 squares toward center (chess.com style).
  const promotionAnchoredAtTop = promotionTargetRow === 1
  const promotionStyle = promotionColumn !== undefined
    ? {
        gridColumn: promotionColumn,
        gridRow: promotionAnchoredAtTop ? "1 / 5" : "5 / 9",
      }
    : undefined

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6 lg:p-6">
      <div className="flex w-fit min-h-0 flex-1 flex-col items-center gap-3 self-center lg:w-auto lg:flex-none lg:self-auto">
        <ClockDisplay color={flipped ? myColor : oppColor} label={flipped ? "You" : "Opponent"} clock={chessState.clock} clockReceivedAt={chessState.clockReceivedAt} />

        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          <Board board={chessState.board} view={{ selected: chessState.selected, legalMoves: chessState.legalMoves, lastMove: chessState.lastMove, flipped: boardFlipped }} onSquareClick={onSquareClick} />
          {chessState.pendingPromotion && promotionColor !== null && promotionStyle && (
            <div
              className="absolute inset-0 z-10 grid"
              style={{ gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)" }}
            >
              <div
                className="col-span-full row-span-full bg-black/40"
                onClick={cancelPromotion}
              />
              <div
                className={`z-20 flex overflow-hidden rounded-md bg-card shadow-2xl ring-1 ring-black/10 ${promotionAnchoredAtTop ? "flex-col" : "flex-col-reverse"}`}
                style={promotionStyle}
              >
                {PROMOTION_PIECES.map((type) => (
                  <button
                    key={type}
                    onClick={() => confirmPromotion(type)}
                    className="flex flex-1 cursor-pointer items-center justify-center border-b p-1.5 transition-colors last:border-b-0 hover:bg-accent"
                  >
                    {getPieceIcon({ type, color: promotionColor }, { className: "size-full" })}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isFinished && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/60 backdrop-blur-sm">
              {state.result!.hasWinner ? (
                <IconCrown className="size-16 text-yellow-400" />
              ) : (
                <IconX className="size-12 text-muted-foreground" />
              )}
              <p className="text-xl font-bold text-white">{resultText}</p>
              <Button variant="secondary" size="sm" onClick={onLeave}>
                Leave
              </Button>
            </div>
          )}
        </div>

        <ClockDisplay color={flipped ? oppColor : myColor} label={flipped ? "Opponent" : "You"} clock={chessState.clock} clockReceivedAt={chessState.clockReceivedAt} />
      </div>

      {!isFinished && (
        <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon" onClick={() => setFlipped((f) => !f)}>
                  <IconFlipHorizontal className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Flip board</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon" onClick={actions.requestUndo}>
                  <IconArrowBackUp className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Request undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon" onClick={() => setShowResign(true)}>
                  <IconFlag className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Resign</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Dialog open={showResign} onOpenChange={setShowResign}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Resign</DialogTitle>
            <DialogDescription>
              Are you sure you want to resign? This will end the game.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={confirmResign}>
              Resign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
