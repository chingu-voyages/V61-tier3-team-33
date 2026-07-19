"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Board as TBoard, Square, StateConfig } from "@/core/board"
import { Position } from "@/core/position"
import type { Piece, PieceColor } from "@/core/piece"
import { BoardSquare } from "./BoardSquare"
import { getPieceIcon } from "../pieces"
import { useEventCallback } from "./use-event-callback"
import { clamp, positionFromCoords, squareCoords } from "./helpers"

interface BoardView extends StateConfig {
  flipped: boolean
}

interface BoardProps {
  board: TBoard
  view: BoardView
  /** The local player's color — gates which pieces can be picked up. */
  myColor?: PieceColor
  onSquareClick: (pos: Position) => void
  onPieceDrop?: (source: Position, target: Position) => void
  onDragStart?: (pos: Position) => void
}

/** Pixels of pointer travel before a press becomes a drag (vs. a click). */
const DRAG_THRESHOLD = 4
/** How long the piece takes to snap into the target square on drop. */
const SNAP_MS = 120
/** How long the piece takes to spring back on an invalid/cancelled drop. */
const RETURN_MS = 150

interface DragSession {
  pointerId: number
  position: Position
  piece: Piece
  startX: number
  startY: number
  originLeft: number
  originTop: number
  squareSize: number
  rect: DOMRect
  moved: boolean
}

interface DragVisual {
  position: Position
  piece: Piece
  originLeft: number
  originTop: number
  squareSize: number
  initialDx: number
  initialDy: number
}

/**
 * The piece being dragged, rendered above the grid. Position is written
 * straight to the DOM node (not through React state) so it can track the
 * pointer at full frame rate without re-rendering the whole board on every
 * pixel of movement — this is the key difference from native HTML5 drag,
 * which hands rendering off to the browser's own (laggy, semi-transparent)
 * drag-image compositor.
 */
function FloatingPiece({
  piece,
  left,
  top,
  size,
  initialDx,
  initialDy,
  nodeRef,
}: {
  piece: Piece
  left: number
  top: number
  size: number
  initialDx: number
  initialDy: number
  nodeRef: React.RefObject<HTMLDivElement | null>
}) {
  // Runs once per mount (i.e. once per drag session). Sets the starting
  // transform imperatively so later pointer-move writes to this same
  // property are never clobbered by a React re-render of this component
  // (e.g. when hover-highlight state updates elsewhere on the board).
  useLayoutEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.style.transform = `translate3d(${initialDx}px, ${initialDy}px, 0)`
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={nodeRef}
      className="pointer-events-none absolute top-0 left-0 z-50"
      style={{ left, top, width: size, height: size, willChange: "transform" }}
    >
      <div className="h-full w-full scale-110 drop-shadow-2xl">
        {getPieceIcon(piece, { className: "h-full w-full" })}
      </div>
    </div>
  )
}

export function Board({
  board,
  view,
  myColor,
  onSquareClick,
  onPieceDrop,
  onDragStart,
}: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const hoverPosRef = useRef<Position | null>(null)
  const suppressClickRef = useRef(false)

  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const [hoverPos, setHoverPos] = useState<Position | null>(null)
  const [justArrivedAt, setJustArrivedAt] = useState<Position | null>(null)

  const movingPieceColor =
    view.selected !== null
      ? Square.decode(TBoard.at(board, view.selected))?.color
      : undefined

  const handlePiecePointerDown = useEventCallback(
    (e: React.PointerEvent, position: Position, piece: Piece) => {
      if (e.pointerType === "mouse" && e.button !== 0) return
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const squareSize = rect.width / 8
      const { row, col } = squareCoords(position, view.flipped)

      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      dragRef.current = {
        pointerId: e.pointerId,
        position,
        piece,
        startX: e.clientX,
        startY: e.clientY,
        originLeft: col * squareSize,
        originTop: row * squareSize,
        squareSize,
        rect,
        moved: false,
      }
    }
  )

  const handlePieceDragMove = useEventCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY

    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true
      document.body.style.cursor = "grabbing"
      // Select the piece the moment a real drag begins (not on plain
      // pointerdown) — mirrors the old native dragstart timing, so a
      // simple click doesn't fire select() twice (once here, once via the
      // square's own onClick).
      onDragStart?.(drag.position)
      setDragVisual({
        position: drag.position,
        piece: drag.piece,
        originLeft: drag.originLeft,
        originTop: drag.originTop,
        squareSize: drag.squareSize,
        initialDx: dx,
        initialDy: dy,
      })
    }

    if (!drag.moved) return

    if (floatingRef.current) {
      floatingRef.current.style.transition = "none"
      floatingRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
    }

    const col = clamp(Math.floor((e.clientX - drag.rect.left) / drag.squareSize), 0, 7)
    const row = clamp(Math.floor((e.clientY - drag.rect.top) / drag.squareSize), 0, 7)
    const hovered = positionFromCoords(row, col, view.flipped)
    if (hovered !== hoverPosRef.current) {
      hoverPosRef.current = hovered
      setHoverPos(hovered)
    }
  })

  const handlePieceDragEnd = useEventCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    dragRef.current = null

    if (!drag.moved) {
      // Never crossed the drag threshold — treat as a plain click and let
      // the square's own onClick (select / move) handle it natively.
      return
    }

    document.body.style.cursor = ""
    hoverPosRef.current = null
    setHoverPos(null)

    // A real drag just ended: the browser may still synthesize a click on
    // whatever square the pointer landed on, which would double up with
    // onPieceDrop below. Swallow exactly that one click.
    suppressClickRef.current = true
    requestAnimationFrame(() => {
      suppressClickRef.current = false
    })

    const withinBounds =
      e.clientX >= drag.rect.left &&
      e.clientX <= drag.rect.right &&
      e.clientY >= drag.rect.top &&
      e.clientY <= drag.rect.bottom

    const returnToOrigin = () => {
      if (floatingRef.current) {
        floatingRef.current.style.transition = `transform ${RETURN_MS}ms cubic-bezier(0.2, 0, 0, 1)`
        floatingRef.current.style.transform = "translate3d(0px, 0px, 0)"
      }
      window.setTimeout(() => setDragVisual(null), RETURN_MS)
    }

    if (withinBounds) {
      const col = clamp(Math.floor((e.clientX - drag.rect.left) / drag.squareSize), 0, 7)
      const row = clamp(Math.floor((e.clientY - drag.rect.top) / drag.squareSize), 0, 7)
      const target = positionFromCoords(row, col, view.flipped)

      // Only treat the drop as a real move if the target is one of the
      // dragged piece's actual legal destinations. Without this check, an
      // illegal drop (wrong turn, pinned piece, blocked square, etc.) would
      // still visually snap the floating piece onto the target square —
      // but onPieceDrop silently no-ops, so board state never updates and
      // the floating piece just gets discarded there while the real piece
      // pops back at the source square, i.e. the piece appears to vanish.
      const isLegalDrop = target !== drag.position && view.legalMoves.includes(target)

      if (isLegalDrop) {
        if (floatingRef.current) {
          const targetLeft = col * drag.squareSize
          const targetTop = row * drag.squareSize
          floatingRef.current.style.transition = `transform ${SNAP_MS}ms cubic-bezier(0.2, 0, 0, 1)`
          floatingRef.current.style.transform = `translate3d(${targetLeft - drag.originLeft}px, ${targetTop - drag.originTop}px, 0)`
        }

        onPieceDrop?.(drag.position, target)
        setJustArrivedAt(target)
        window.setTimeout(() => setJustArrivedAt(null), SNAP_MS + 60)
        window.setTimeout(() => setDragVisual(null), SNAP_MS)
      } else {
        returnToOrigin()
      }
    } else {
      returnToOrigin()
    }
  })

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
        myColor={myColor}
        isDragSource={dragVisual?.position === position}
        isDragHover={dragVisual !== null && hoverPos === position}
        justArrived={justArrivedAt === position}
        onSquareClick={onSquareClick}
        onPiecePointerDown={handlePiecePointerDown}
        onPieceDragMove={handlePieceDragMove}
        onPieceDragEnd={handlePieceDragEnd}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative grid h-full w-full grid-cols-8 grid-rows-8"
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      {view.flipped ? squares.toReversed() : squares}
      {dragVisual && (
        <FloatingPiece
          piece={dragVisual.piece}
          left={dragVisual.originLeft}
          top={dragVisual.originTop}
          size={dragVisual.squareSize}
          initialDx={dragVisual.initialDx}
          initialDy={dragVisual.initialDy}
          nodeRef={floatingRef}
        />
      )}
    </div>
  )
}
