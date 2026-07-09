import { Brand } from "./brand"

export type File = Brand<number, "File">

export const File = Object.assign((value: number): File => value as File, {
  toString(file: File): string {
    return String.fromCharCode(65 + file)
  },

  parse(letter: string): File | null {
    if (letter.length !== 1) return null
    const code = letter.charCodeAt(0)
    if (code >= 65 && code <= 72) return File(code - 65)
    if (code >= 97 && code <= 104) return File(code - 97)
    return null
  },
})

export const FILE_A: File = File(0)
export const FILE_B: File = File(1)
export const FILE_C: File = File(2)
export const FILE_D: File = File(3)
export const FILE_E: File = File(4)
export const FILE_F: File = File(5)
export const FILE_G: File = File(6)
export const FILE_H: File = File(7)

export type Rank = Brand<number, "Rank">

export const Rank = Object.assign((value: number): Rank => value as Rank, {
  toString(rank: Rank): string {
    return String.fromCharCode(49 + rank)
  },

  parse(digit: string): Rank | null {
    if (digit.length !== 1) return null
    const code = digit.charCodeAt(0)
    if (code >= 49 && code <= 56) return Rank(code - 49)
    return null
  },
})

export const RANK_1: Rank = Rank(0)
export const RANK_2: Rank = Rank(1)
export const RANK_3: Rank = Rank(2)
export const RANK_4: Rank = Rank(3)
export const RANK_5: Rank = Rank(4)
export const RANK_6: Rank = Rank(5)
export const RANK_7: Rank = Rank(6)
export const RANK_8: Rank = Rank(7)

export type Position = Brand<number, "Position">

export const Position = Object.assign(
  (value: number): Position => value as Position,
  {
    create(file: File, rank: Rank): Position {
      return Position(file * 8 + rank)
    },

    file(position: Position): File {
      return File(Math.floor(position / 8))
    },

    rank(position: Position): Rank {
      return Rank(position % 8)
    },

    index(position: Position): number {
      return position
    },

    isValid(position: Position): boolean {
      return position >= POSITION_MIN && position <= POSITION_MAX
    },

    toString(position: Position): string {
      if (!Position.isValid(position)) return "-"
      return (
        File.toString(Position.file(position)) +
        Rank.toString(Position.rank(position))
      )
    },

    isDarkSquare(position: Position): boolean {
      return (Position.file(position) + Position.rank(position)) % 2 === 0
    },

    parse(str: string): Position | null {
      if (str.length !== 2) return null
      const file = File.parse(str[0]!)
      const rank = Rank.parse(str[1]!)
      if (file === null || rank === null) return null
      return Position.create(file, rank)
    },
  }
)

export const NO_POSITION: Position = Position(64)

const POSITION_MIN: Position = Position(0)
const POSITION_MAX: Position = Position(63)
