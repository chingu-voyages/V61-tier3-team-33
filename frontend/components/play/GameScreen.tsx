"use client"

import { IconDoorExit } from "@tabler/icons-react"

import { Board } from "@/components/board/Board"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useGame } from "@/context/use-game"
import { KING, WHITE, BLACK, PieceColor } from "@/lib/core/piece"
import { getPieceIcon } from "@/components/pieces"
import { ResignButton } from "./ResignButton"
import {
  CHECKMATE,
  DRAW,
  RESIGNATION,
  TIMEOUT,
  ABANDONED,
  STALEMATE,
  THREEFOLD_REPETITION,
  FIFTY_MOVE_RULE,
  INSUFFICIENT_MATERIAL,
  type GameOutcome,
} from "@/socket/incoming"

function colorLabel(color: PieceColor): string {
  return color === WHITE ? "White" : "Black"
}

/** Small dot + label showing whose move it is. Null (not rendered) once
 * the game is over, or before GameState.turn exists. */
function TurnIndicator({
  turn,
  color,
}: {
  turn: PieceColor | null
  color: PieceColor | null
}) {
  if (turn === null) return null
  const isYourTurn = turn === color

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span
        className={cn(
          "size-2.5 rounded-full border",
          turn === WHITE
            ? "border-neutral-400 bg-white"
            : "border-neutral-900 bg-neutral-900"
        )}
      />
      <span
        className={cn(
          isYourTurn ? "font-medium text-foreground" : "text-muted-foreground"
        )}
      >
        {isYourTurn ? "Your turn" : "Opponent's turn"}
      </span>
    </span>
  )
}

function drawReasonLabel(reason: GameOutcome["drawReason"]): string {
  switch (reason) {
    case STALEMATE:
      return "stalemate"
    case THREEFOLD_REPETITION:
      return "threefold repetition"
    case FIFTY_MOVE_RULE:
      return "the fifty-move rule"
    case INSUFFICIENT_MATERIAL:
      return "insufficient material"
    default:
      return "agreement"
  }
}

function endReasonLabel(reason: GameOutcome["reason"]): string {
  switch (reason) {
    case RESIGNATION:
      return "resignation"
    case TIMEOUT:
      return "timeout"
    case ABANDONED:
      return "the opponent leaving"
    default:
      return "the rules"
  }
}

/** Human-readable summary of a finished game, or null while still in progress. */
function outcomeSummary(result: GameOutcome | null): string | null {
  if (!result) return null
  if (result.status === CHECKMATE) {
    return `${colorLabel(result.winner)} wins by checkmate`
  }
  if (result.status === DRAW) {
    return `Draw by ${drawReasonLabel(result.drawReason)}`
  }
  // status is still IN_PROGRESS but the game ended some other way, e.g.
  // resignation or timeout — GAME_ENDED sets hasWinner in that case.
  if (result.hasWinner) {
    return `${colorLabel(result.winner)} wins by ${endReasonLabel(result.reason)}`
  }
  return null
}

/**
 * A king badge for the game-over dialog: the winner's king on a decisive
 * result, or both kings facing off for a draw. Piece icons are already
 * drawn for board squares (see components/pieces), so this reuses them
 * rather than pulling in separate art.
 */
function OutcomeArt({ result }: { result: GameOutcome }) {
  if (result.hasWinner) {
    return (
      <div
        className={cn(
          "mx-auto flex size-20 items-center justify-center rounded-full ring-1 ring-foreground/10",
          result.winner === WHITE ? "bg-white" : "bg-neutral-800"
        )}
      >
        {getPieceIcon(
          { type: KING, color: result.winner },
          { className: "size-14" }
        )}
      </div>
    )
  }

  // Draw: neither side lost, so both kings appear at equal size, side by
  // side rather than one badge outranking the other.
  return (
    <div className="mx-auto flex items-center gap-2">
      <div className="flex size-16 items-center justify-center rounded-full bg-white ring-1 ring-foreground/10">
        {getPieceIcon({ type: KING, color: WHITE }, { className: "size-11" })}
      </div>
      <span className="text-sm font-medium text-muted-foreground">–</span>
      <div className="flex size-16 items-center justify-center rounded-full bg-neutral-800 ring-1 ring-foreground/10">
        {getPieceIcon({ type: KING, color: BLACK }, { className: "size-11" })}
      </div>
    </div>
  )
}

/**
 * Rendered once game:started (or an already-finished room:joined) has
 * given us a real position to show. Wraps the existing Board with the
 * minimal chrome needed to leave a game: your seat, a resign action, and
 * a game-over banner. Move-making UI (drag/click to move) isn't wired up
 * yet — this is the "show the board" half of the flow, not full play.
 */
export function GameScreen() {
  const { state, actions } = useGame()
  const summary = outcomeSummary(state.result)
  const gameOver = summary !== null

  return (
    <div className="flex w-full max-w-160 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            Playing as{" "}
            <span className="font-medium text-foreground">
              {state.color !== null ? colorLabel(state.color) : "—"}
            </span>
            {state.isCheck && !gameOver && (
              <span className="ml-2 font-medium text-destructive">Check</span>
            )}
          </span>

          {!gameOver && <TurnIndicator turn={state.turn} color={state.color} />}
        </div>

        {!gameOver && <ResignButton onConfirm={actions.resign} />}
      </div>

      {state.pendingUndo && (
        <div className="flex items-center justify-between rounded-2xl border bg-muted/50 px-4 py-2 text-sm">
          <span>Opponent requested an undo.</span>
          <div className="flex gap-2">
            <Button size="xs" onClick={actions.acceptUndo}>
              Accept
            </Button>
            <Button size="xs" variant="outline" onClick={actions.declineUndo}>
              Decline
            </Button>
          </div>
        </div>
      )}

      <div className={cn("relative", gameOver && "pointer-events-none")}>
        <Board board={state.board} turn={state.turn} color={state.color} isCheck={state.isCheck} />
      </div>

      {/* Shown to both players off the same shared GameState.result, so
       * neither side can see a stale board underneath while deciding
       * what to do next. */}
      <Dialog open={gameOver}>
        <DialogContent showCloseButton={false} className="text-center">
          {state.result && <OutcomeArt result={state.result} />}
          <DialogHeader>
            <DialogTitle className="text-center text-lg">{summary}</DialogTitle>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button variant="secondary" onClick={actions.leaveRoom}>
              <IconDoorExit data-icon="inline-start" />
              Back to dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
