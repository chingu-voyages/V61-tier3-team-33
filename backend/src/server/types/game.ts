import type { Brand, GameResult, PieceColor, PieceType, GameStatus, DrawReason, Position } from "./chess";
import { brandedTag } from "./chess";
import type { ClockFormat } from "./clock";

export type Lifecycle = Brand<number, "Lifecycle">;
export const Lifecycle = (value: number): Lifecycle => value as Lifecycle;
export const WAITING: Lifecycle = Lifecycle(0);
export const ACTIVE: Lifecycle = Lifecycle(1);
export const FINISHED: Lifecycle = Lifecycle(2);

export type Mode = Brand<number, "Mode">;
export const Mode = (value: number): Mode => value as Mode;
export const HUMAN_VS_HUMAN: Mode = Mode(0);
export const HUMAN_VS_AI: Mode = Mode(1);
export const AI_VS_AI: Mode = Mode(2);

export type Difficulty = Brand<number, "Difficulty">;
export const Difficulty = (value: number): Difficulty => value as Difficulty;
export const EASY: Difficulty = Difficulty(0);
export const MEDIUM: Difficulty = Difficulty(1);
export const HARD: Difficulty = Difficulty(2);

export type EndReason = Brand<number, "EndReason">;
export const EndReason = (value: number): EndReason => value as EndReason;
export const RULES: EndReason = EndReason(0);
export const TIMEOUT: EndReason = EndReason(1);
export const RESIGNATION: EndReason = EndReason(2);
export const ABANDONED: EndReason = EndReason(3);

export interface GameOutcome extends GameResult {
  reason: EndReason;
}

export const GameOutcome = {
  fromSnapshot(snapshot: GameSnapshot): GameOutcome {
    return {
      status: snapshot.resultStatus,
      winner: snapshot.winner,
      hasWinner: snapshot.hasWinner,
      drawReason: snapshot.drawReason,
      reason: snapshot.endReason,
    };
  },
};

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  active: PieceColor | null;
}

export interface GameSnapshot {
  status: Lifecycle;
  fen: string;
  turn: PieceColor;
  isCheck: boolean;
  resultStatus: GameStatus;
  winner: PieceColor;
  hasWinner: boolean;
  drawReason: DrawReason;
  endReason: EndReason;
  history: string[];
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  clock: ClockState | null;
}

export interface MoveInput {
  from: Position;
  to: Position;
  promoteTo?: PieceType;
}

export interface JoinInput {
  roomId?: string;
  mode: Mode;
  color?: PieceColor;
  difficulty?: Difficulty;
  clock?: ClockFormat;
}

const OccupantKind = brandedTag<"OccupantKind">();

export const HUMAN = OccupantKind("human");
export const AI = OccupantKind("ai");

export type OccupantKind = typeof HUMAN | typeof AI;

export interface WebSocket {
  readonly id: string;
  readonly readyState: number;
  send(data: string): void;
  close(): void;
}

export const WS_OPEN = 1;
