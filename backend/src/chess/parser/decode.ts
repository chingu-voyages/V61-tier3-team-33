import type { TurnContext } from "../core/state";

import { Board, Square } from "../core/board";
import { Piece, KING, WHITE, BLACK } from "../core/piece";
import {
  Position,
  File,
  Rank,
  NO_POSITION,
  RANK_3,
  RANK_6,
} from "../core/position";
import { MoveContext } from "../core/state";

/**
 * Parses the first FEN field — the 8-rank ASCII board layout.
 *
 * Iterates character-by-character through the piece-placement substring
 * (e.g. `"rnbqkbnr/pppppppp/8/..."`), placing each piece letter on the
 * corresponding board square and auto-detecting king positions.
 *
 * The FEN string lists ranks from top (rank 8) to bottom (rank 1), each
 * rank left-to-right from file A to file H.  Consecutive empty squares
 * are collapsed into a single digit `'1'`…`'8'`.  Ranks are separated
 * by `'/'` and the field is terminated by a space.
 *
 * @param str   The complete FEN string being parsed.
 * @param ctx   The context whose board and side-states are populated.
 * @param start Byte offset into `str` where the piece-placement field begins.
 * @returns A tuple `[nextIndex, error]` where `nextIndex` is the byte
 *          offset of the space terminator + 1, and `error` is `null` on
 *          success or a human-readable message on failure.
 */
function decodePiecePlacement(
  str: string,
  ctx: TurnContext,
  start: number,
): [number, string | null] {
  let rank = 0; // 0-based FEN rank counter (0 = rank 8, 7 = rank 1)
  let file = 0;

  for (let i = start; i < str.length; i++) {
    const letter = str.charAt(i);

    // space terminates the piece-placement field
    if (letter === " ") {
      // after 8 ranks × 8 files, the board is fully populated
      if (rank + 1 !== 8 || file !== 8) {
        return [0, `fen: expected 8 ranks, got ${rank + 1}`];
      }

      return [i + 1, null];
    }

    // slash marks the boundary between two ranks
    if (letter === "/") {
      // each rank must have exactly 8 files (pieces + digits)
      if (file !== 8) {
        return [
          0,
          `fen: rank ${Rank.reverse(Rank(rank)) + 1} has ${file} files, want 8`,
        ];
      }
      file = 0;
      rank++;

      // FEN has exactly 8 ranks (no more, no fewer)
      if (rank >= 8) {
        return [0, "fen: too many ranks"];
      }
      continue;
    }

    // digit '1'-'8' represents that many consecutive empty squares
    const digit = letter.charCodeAt(0) - 48;
    if (digit >= 1 && digit <= 8) {
      // digit would push the file counter past the 8-file boundary
      if (file + digit > 8) {
        return [
          0,
          `fen: rank ${Rank.reverse(Rank(rank)) + 1} overflows 8 files`,
        ];
      }

      file += digit;
      continue;
    }

    // anything else is treated as a piece letter (P, N, B, R, Q, K or lowercase)
    // but before we parse, verify the rank hasn't already overflowed
    if (file >= 8) {
      return [0, `fen: rank ${Rank.reverse(Rank(rank)) + 1} overflows 8 files`];
    }

    const piece = Piece.parse(letter);
    // unknown letter (e.g. 'x' or 'v') is not a valid FEN piece character
    if (!piece) {
      return [
        0,
        `fen: rank ${Rank.reverse(Rank(rank)) + 1}: invalid piece letter '${letter}'`,
      ];
    }

    // FEN rank index 0 = internal rank 7 (RANK_8), index 7 = internal rank 0 (RANK_1)
    const position = Position.create(File(file), Rank.reverse(Rank(rank)));
    Board.place(ctx.board, position, Square.create(piece));

    // engine needs KingPosition set for castling / king-safety checks
    if (piece.type === KING) {
      MoveContext.sideOf(ctx, piece.color).kingPosition = position;
    }

    file++;
  }

  return [0, "fen: piece placement field is incomplete, no space terminator"];
}

/**
 * Parses the second FEN field — a single letter `'w'` or `'b'`.
 *
 * Sets `ctx.sideToMove` to the active colour.  The field is exactly one
 * character followed by a space (which this function skips).
 *
 * @param str   The complete FEN string.
 * @param start Byte offset where the side-to-move letter starts.
 * @param ctx   The context whose `sideToMove` is updated.
 * @returns A tuple `[nextIndex, error]` — `nextIndex` is the offset right
 *          after the trailing space.
 */
function decodeSideToMove(
  str: string,
  start: number,
  ctx: TurnContext,
): [number, string | null] {
  // FEN must have a side-to-move field (cannot end after piece placement)
  if (start >= str.length) {
    return [0, "fen: missing side-to-move field"];
  }

  const letter = str.charAt(start);
  if (letter === "w") {
    ctx.sideToMove = WHITE;
  } else if (letter === "b") {
    ctx.sideToMove = BLACK;
  } else {
    // only 'w' or 'b' are valid; 'W', 'B', or any other letter is an error
    return [0, `fen: invalid sideToMove letter '${letter}', expected w or b`];
  }

  return [start + 2, null]; // skip letter + space
}

/**
 * Parses the third FEN field — castling availability: `'KQkq'` (any subset)
 * or `'-'` when neither side can castle.
 *
 * Each of the four letters `K`, `Q`, `k`, `q` appears at most once (duplicates
 * are harmless — the right is simply set to `true` again).  Letters may appear
 * in any order.  The field is terminated by a space.
 *
 * @param str   The complete FEN string.
 * @param start Byte offset where the castling-rights field begins.
 * @param ctx   The context whose side-state castling flags are updated.
 * @returns A tuple `[nextIndex, error]`.
 */
function decodeCastlingRights(
  str: string,
  start: number,
  ctx: TurnContext,
): [number, string | null] {
  // FEN must have a castling-rights field
  if (start >= str.length) {
    return [0, "fen: missing castling-rights field"];
  }

  for (let i = start; i < str.length; i++) {
    const letter = str.charAt(i);
    // space terminates the castling-rights field
    if (letter === " ") {
      return [i + 1, null];
    }

    switch (letter) {
      case "K":
        MoveContext.sideOf(ctx, WHITE).canCastleKingSide = true;
        break;
      case "Q":
        MoveContext.sideOf(ctx, WHITE).canCastleQueenSide = true;
        break;
      case "k":
        MoveContext.sideOf(ctx, BLACK).canCastleKingSide = true;
        break;
      case "q":
        MoveContext.sideOf(ctx, BLACK).canCastleQueenSide = true;
        break;
      case "-":
        // dash means no rights; the context starts with all false already
        break;
      default:
        // any other character (e.g. 'X') is invalid
        return [
          0,
          `fen: invalid castle rights letter '${letter}', expected any of [K, Q, k, q, -]`,
        ];
    }
  }

  return [0, "fen: castling-rights field is incomplete, no space terminator"];
}

/**
 * Parses the fourth FEN field — the en-passant target square.
 *
 * Either a dash `'-'` (meaning no en passant is possible this ply) or an
 * algebraic square like `"e3"` or `"d6"`.  FEN only allows rank 3 (white
 * just pushed a pawn two squares) or rank 6 (black just pushed).
 *
 * @param str   The complete FEN string.
 * @param start Byte offset where the en-passant field begins.
 * @param ctx   The context whose `enPassantTarget` is set.
 * @returns A tuple `[nextIndex, error]`.
 */
function decodeEnPassantTarget(
  str: string,
  start: number,
  ctx: TurnContext,
): [number, string | null] {
  // FEN must have an en-passant-target field
  if (start >= str.length) {
    return [0, "fen: missing en-passant-target field"];
  }

  // dash means no en passant target this ply
  if (str[start] === "-") {
    ctx.enPassantTarget = NO_POSITION;
    return [start + 2, null]; // skip '-' + space
  }

  // otherwise we expect exactly two characters: a file letter + a rank digit
  if (start + 1 >= str.length) {
    return [
      0,
      "fen: en-passant target is too short, expected a file letter and rank digit",
    ];
  }

  const file = File.parse(str.charAt(start));
  // file must be one of a-h (or A-H, normalised to lower by File.parse)
  if (file === null) {
    return [
      0,
      `fen: en-passant target file: invalid file letter '${str[start]}'`,
    ];
  }

  const rank = Rank.parse(str.charAt(start + 1));
  // rank must be a single digit 1-8
  if (rank === null) {
    return [
      0,
      `fen: en-passant target rank: invalid rank digit '${str[start + 1]}'`,
    ];
  }

  // per the FEN spec, the en-passant target square is always rank 3 or rank 6
  if (rank !== RANK_3 && rank !== RANK_6) {
    return [0, `fen: en-passant target rank must be 3 or 6, got ${rank + 1}`];
  }

  ctx.enPassantTarget = Position.create(file, rank);
  return [start + 3, null]; // skip file + rank + space
}

/**
 * Parses the fifth FEN field — the halfmove clock as a decimal number.
 *
 * This clock tracks the number of plies since the last pawn advance or
 * capture (for the fifty-move rule).  The field extends until the next
 * space or the end of the string (it is not the last field).
 *
 * @param str   The complete FEN string.
 * @param start Byte offset where the halfmove-clock number begins.
 * @param ctx   The context whose `halfMoveClock` is set.
 * @returns A tuple `[nextIndex, error]`.
 */
function decodeHalfMoveClock(
  str: string,
  start: number,
  ctx: TurnContext,
): [number, string | null] {
  // scan forward to find the next space (or end of string)
  let i = start;
  while (i < str.length && str[i] !== " ") {
    i++;
  }

  // zero-length digit string means the field was missing entirely
  if (i === start) {
    return [0, "fen: missing halfmove-clock field"];
  }

  const raw = str.slice(start, i);
  const clock = parseInt(raw, 10);
  // halfmove clock must be a non-negative integer; NaN or negatives are invalid
  if (isNaN(clock) || clock < 0) {
    return [0, `fen: invalid halfmove-clock '${raw}'`];
  }

  ctx.halfMoveClock = clock;

  // skip the trailing space unless this is the last field (then there is no space)
  if (i < str.length) {
    i++; // skip ' '
  }

  return [i, null];
}

/**
 * Parses the sixth FEN field — the fullmove number as a decimal number.
 *
 * This is the game move counter, starting at 1 and incrementing after
 * every black move.  It is the last field in the FEN string.
 *
 * @param str   The complete FEN string.
 * @param start Byte offset where the fullmove number begins.
 * @param ctx   The context whose `fullMoveNumber` is set.
 * @returns `null` on success or a human-readable error message on failure.
 */
function decodeFullMoveNumber(
  str: string,
  start: number,
  ctx: TurnContext,
): string | null {
  // scan to end of string (this is the last field, no trailing space)
  let i = start;
  while (i < str.length) {
    i++;
  }

  // zero-length means the field was missing entirely
  if (i === start) {
    return "fen: missing fullmove-number field";
  }

  const raw = str.slice(start, i);
  const num = parseInt(raw, 10);
  // fullmove number must be a positive integer; NaN is invalid
  if (isNaN(num) || num < 0) {
    return `fen: invalid fullmove-number '${raw}'`;
  }

  ctx.fullMoveNumber = num;
  return null;
}

/**
 * Parses a complete FEN string into a TurnContext.
 *
 * Resets all context fields before parsing so that repeated calls on the
 * same context leave no stale state from a previous decode.
 *
 * Parsing proceeds through all six FEN fields in order, returning the
 * first error encountered.  If every field is valid the context is fully
 * populated and ready for the engine.
 *
 * @param str The FEN string to parse.
 * @param ctx The context that receives the parsed position (mutated in place).
 * @returns `null` on success, or an error message string on failure.
 */
export function decodeFEN(str: string, ctx: TurnContext): string | null {
  // reset all fields to their zero-like defaults so repeated decodes
  // on the same context produce a clean slate
  ctx.board = Board.create();
  ctx.sideToMove = WHITE;
  ctx.sides = [
    {
      kingPosition: NO_POSITION,
      canCastleKingSide: false,
      canCastleQueenSide: false,
    },
    {
      kingPosition: NO_POSITION,
      canCastleKingSide: false,
      canCastleQueenSide: false,
    },
  ];
  ctx.enPassantTarget = NO_POSITION;
  ctx.halfMoveClock = 0;
  ctx.fullMoveNumber = 0;

  let index = 0;
  let err: string | null;

  // 1. piece placement
  [index, err] = decodePiecePlacement(str, ctx, index);
  if (err !== null) return err;

  // 2. side to move
  [index, err] = decodeSideToMove(str, index, ctx);
  if (err !== null) return err;

  // 3. castling rights
  [index, err] = decodeCastlingRights(str, index, ctx);
  if (err !== null) return err;

  // 4. en passant target
  [index, err] = decodeEnPassantTarget(str, index, ctx);
  if (err !== null) return err;

  // 5. halfmove clock
  [index, err] = decodeHalfMoveClock(str, index, ctx);
  if (err !== null) return err;

  // 6. fullmove number
  err = decodeFullMoveNumber(str, index, ctx);
  if (err !== null) return err;

  return null;
}
