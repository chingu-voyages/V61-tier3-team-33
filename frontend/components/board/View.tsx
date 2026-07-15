"use client"

import { useCallback, useReducer } from "react"
import Image from "next/image"
import { useRoom } from "@/context/room/context"
import { useChess } from "@/chess/context"
import { Board } from "@/components/board/Board"
import { WHITE, BLACK } from "@/core/piece"
import { Position } from "@/core/position"
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
  IconX,
  IconDotsVertical,
} from "@tabler/icons-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ClockDisplay } from "./ClockDisplay"
import { EmoteTray } from "./EmoteTray"
import { EmoteOverlay } from "./EmoteOverlay"
import { FINISHED } from "@/socket/types"
import { useEventCallback } from "./use-event-callback"
import { useSocketEvent } from "@/socket/use-event"
import { EMOTE_RECEIVED } from "@/socket/events"
import { viewReducer, initialViewState } from "./view-reducer"
import { PromotionOverlay } from "./PromotionOverlay"
import { useUndoRequest } from "./use-undo-request"
import { useGameResult } from "./use-game-result"

interface ViewProps {
  onLeave: () => void
}

export function View({ onLeave }: ViewProps) {
  const { state, actions } = useRoom()
  const {
    state: chessState,
    makeMove,
    select,
    confirmPromotion,
    cancelPromotion,
  } = useChess()
  const [view, dispatch] = useReducer(viewReducer, initialViewState)
  const { showUndoRequest, isMyUndoPending } = useUndoRequest(state, dispatch)
  const { isFinished, resultText } = useGameResult(state)

  useSocketEvent(EMOTE_RECEIVED, (e) => {
    dispatch({ type: "RECEIVE_EMOTE", emote: e.emote })
  })

  // Stable identity so Board's memoized squares don't re-render on every
  // move, while still reading the latest chess/room state on each click.
  const onSquareClick = useEventCallback((pos: Position) => {
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
  })

  const confirmResign = useCallback(() => {
    dispatch({ type: "HIDE_RESIGN" })
    actions.resign()
  }, [actions])

  const confirmUndo = useCallback(() => {
    dispatch({ type: "HIDE_UNDO_CONFIRM" })
    dispatch({ type: "AGREE_TO_UNDO_TERMS", value: false })
    actions.requestUndo()
  }, [actions])

  const cancelUndo = useCallback(() => {
    actions.cancelUndo()
  }, [actions])

  const acceptUndo = useCallback(() => {
    dispatch({ type: "AGREE_TO_OPPONENT_UNDO_TERMS", value: false })
    actions.acceptUndo()
  }, [actions])

  const declineUndo = useCallback(() => {
    dispatch({ type: "AGREE_TO_OPPONENT_UNDO_TERMS", value: false })
    actions.declineUndo()
  }, [actions])

  if (state.color === null) return null

  const myColor = state.color
  const oppColor = myColor === WHITE ? BLACK : WHITE
  const baseFlipped = state.color === BLACK
  const boardFlipped = baseFlipped !== view.flipped

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:justify-center sm:gap-6 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col items-center self-center sm:self-stretch">
        <div
          className="mx-auto flex min-h-0 w-full flex-1 flex-col items-center gap-3"
          style={{ maxWidth: "80vh" }}
        >
          <div className="flex w-full items-center gap-2">
            <div className="relative min-w-0 flex-1">
              {(view.flipped ? view.sentEmote : view.receivedEmote) !== null && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2">
                  <EmoteOverlay
                    key={view.flipped ? view.sentEmoteKey : view.emoteKey}
                    emote={(view.flipped ? view.sentEmote : view.receivedEmote) as string}
                  />
                </div>
              )}
              <ClockDisplay
                color={view.flipped ? myColor : oppColor}
                label={view.flipped ? "You" : "Opponent"}
                clock={chessState.clock}
                clockReceivedAt={chessState.clockReceivedAt}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-md min-[950px]:hidden"
                  >
                    <IconDotsVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => dispatch({ type: "FLIP" })}>
                  <IconFlipHorizontal className="size-4" />
                  Flip board
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (isMyUndoPending) {
                      cancelUndo()
                    } else {
                      dispatch({ type: "SHOW_UNDO_CONFIRM" })
                    }
                  }}
                >
                  <IconArrowBackUp className="size-4" />
                  {isMyUndoPending ? "Cancel undo" : "Request undo"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => dispatch({ type: "SHOW_RESIGN" })}
                  variant="destructive"
                >
                  <IconFlag className="size-4" />
                  Resign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative my-auto aspect-square w-full min-w-72">
            <Board
              board={chessState.board}
              view={{
                selected: chessState.selected,
                legalMoves: chessState.legalMoves,
                lastMove: chessState.lastMove,
                flipped: boardFlipped,
              }}
              onSquareClick={onSquareClick}
            />
            {chessState.pendingPromotion && (
              <PromotionOverlay
                pendingPromotion={chessState.pendingPromotion}
                board={chessState.board}
                boardFlipped={boardFlipped}
                onCancel={cancelPromotion}
                onConfirm={confirmPromotion}
              />
            )}
            {isFinished && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/60 backdrop-blur-sm">
                {state.result!.hasWinner ? (
                  <Image
                    src={
                      state.color === WHITE
                        ? state.result!.winner === WHITE
                          ? "/defeat/White_Winner.png"
                          : "/defeat/White_Defeated.png"
                        : state.result!.winner === BLACK
                          ? "/defeat/Black_Winner.png"
                          : "/defeat/Black_Defeated.png"
                    }
                    alt={resultText}
                    width={400}
                    height={400}
                    className="w-3/5 object-contain"
                  />
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

          <div className="flex w-full items-center gap-2">
            <div className="relative min-w-0 flex-1">
              {(view.flipped ? view.receivedEmote : view.sentEmote) !== null && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2">
                  <EmoteOverlay
                    key={view.flipped ? view.emoteKey : view.sentEmoteKey}
                    emote={(view.flipped ? view.receivedEmote : view.sentEmote) as string}
                  />
                </div>
              )}
              <ClockDisplay
                color={view.flipped ? oppColor : myColor}
                label={view.flipped ? "Opponent" : "You"}
                clock={chessState.clock}
                clockReceivedAt={chessState.clockReceivedAt}
              />
            </div>
            {state.status !== FINISHED && (
              <EmoteTray
                onSend={(emote) => {
                  actions.sendEmote(emote)
                  dispatch({ type: "SEND_EMOTE", emote })
                }}
              />
            )}
          </div>
        </div>
      </div>

      {!isFinished && (
        <div className="hidden items-center justify-center gap-2 min-[950px]:flex min-[950px]:flex-col min-[950px]:self-start">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => dispatch({ type: "FLIP" })}
                >
                  <IconFlipHorizontal className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Flip board</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (isMyUndoPending) {
                      cancelUndo()
                    } else {
                      dispatch({ type: "SHOW_UNDO_CONFIRM" })
                    }
                  }}
                >
                  <IconArrowBackUp className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">
              {isMyUndoPending ? "Cancel undo request" : "Request undo"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => dispatch({ type: "SHOW_RESIGN" })}
                >
                  <IconFlag className="size-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Resign</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Dialog
        open={view.showResign}
        onOpenChange={(open) =>
          dispatch({ type: open ? "SHOW_RESIGN" : "HIDE_RESIGN" })
        }
      >
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

      <Dialog
        open={view.showUndoConfirm}
        onOpenChange={(open) =>
          dispatch({ type: open ? "SHOW_UNDO_CONFIRM" : "HIDE_UNDO_CONFIRM" })
        }
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Request undo</DialogTitle>
            <DialogDescription>
              By requesting an undo, you agree to the following conditions:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Only the player who just moved may request an undo</li>
            <li>Undoing will reverse the last move played</li>
            <li>
              If the game ended by checkmate or stalemate, undoing will reopen
              the game
            </li>
            <li>
              Once accepted, the game state will be restored to before the last
              move
            </li>
          </ul>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={view.agreedToUndoTerms}
              onChange={(e) =>
                dispatch({
                  type: "AGREE_TO_UNDO_TERMS",
                  value: e.target.checked,
                })
              }
              className="size-4 rounded border-input accent-primary"
            />
            I understand and agree to these conditions
          </label>
          <DialogFooter showCloseButton>
            <Button
              variant="default"
              disabled={!view.agreedToUndoTerms}
              onClick={confirmUndo}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUndoRequest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo request</DialogTitle>
            <DialogDescription>
              Your opponent has requested an undo. By accepting, you agree to
              the following conditions:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Undoing will reverse the last move played</li>
            <li>
              If the game ended by checkmate or stalemate, undoing will reopen
              the game
            </li>
            <li>
              Once accepted, the game state will be restored to before the last
              move
            </li>
          </ul>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={view.agreedToOpponentUndoTerms}
              onChange={(e) =>
                dispatch({
                  type: "AGREE_TO_OPPONENT_UNDO_TERMS",
                  value: e.target.checked,
                })
              }
              className="size-4 rounded border-input accent-primary"
            />
            I agree to the terms above
          </label>
          <DialogFooter showCloseButton>
            <Button variant="outline" onClick={declineUndo}>
              Decline
            </Button>
            <Button
              variant="default"
              disabled={!view.agreedToOpponentUndoTerms}
              onClick={acceptUndo}
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
