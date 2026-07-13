import type { Brand } from "./brand"

export type File = Brand<number, "File">

export const File = Object.assign((value: number): File => value as File, {
  add(file: File, delta: number): [File, boolean] {
    const result = file + delta
    if (result < FILE_MIN || result > FILE_MAX) return [FILE_A, false]
    return [File(result), true]
  },

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

const FILE_MIN: File = FILE_A
const FILE_MAX: File = FILE_H

export type Rank = Brand<number, "Rank">

export const Rank = Object.assign((value: number): Rank => value as Rank, {
  add(rank: Rank, delta: number): [Rank, boolean] {
    const result = rank + delta
    if (result < RANK_MIN || result > RANK_MAX) return [RANK_1, false]
    return [Rank(result), true]
  },

  toString(rank: Rank): string {
    return String.fromCharCode(49 + rank)
  },

  reverse(rank: Rank): Rank {
    return Rank(RANK_MAX - rank)
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

const RANK_MIN: Rank = RANK_1
const RANK_MAX: Rank = RANK_8

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

export const A1: Position = Position(0)
export const A2: Position = Position(1)
export const A3: Position = Position(2)
export const A4: Position = Position(3)
export const A5: Position = Position(4)
export const A6: Position = Position(5)
export const A7: Position = Position(6)
export const A8: Position = Position(7)
export const B1: Position = Position(8)
export const B2: Position = Position(9)
export const B3: Position = Position(10)
export const B4: Position = Position(11)
export const B5: Position = Position(12)
export const B6: Position = Position(13)
export const B7: Position = Position(14)
export const B8: Position = Position(15)
export const C1: Position = Position(16)
export const C2: Position = Position(17)
export const C3: Position = Position(18)
export const C4: Position = Position(19)
export const C5: Position = Position(20)
export const C6: Position = Position(21)
export const C7: Position = Position(22)
export const C8: Position = Position(23)
export const D1: Position = Position(24)
export const D2: Position = Position(25)
export const D3: Position = Position(26)
export const D4: Position = Position(27)
export const D5: Position = Position(28)
export const D6: Position = Position(29)
export const D7: Position = Position(30)
export const D8: Position = Position(31)
export const E1: Position = Position(32)
export const E2: Position = Position(33)
export const E3: Position = Position(34)
export const E4: Position = Position(35)
export const E5: Position = Position(36)
export const E6: Position = Position(37)
export const E7: Position = Position(38)
export const E8: Position = Position(39)
export const F1: Position = Position(40)
export const F2: Position = Position(41)
export const F3: Position = Position(42)
export const F4: Position = Position(43)
export const F5: Position = Position(44)
export const F6: Position = Position(45)
export const F7: Position = Position(46)
export const F8: Position = Position(47)
export const G1: Position = Position(48)
export const G2: Position = Position(49)
export const G3: Position = Position(50)
export const G4: Position = Position(51)
export const G5: Position = Position(52)
export const G6: Position = Position(53)
export const G7: Position = Position(54)
export const G8: Position = Position(55)
export const H1: Position = Position(56)
export const H2: Position = Position(57)
export const H3: Position = Position(58)
export const H4: Position = Position(59)
export const H5: Position = Position(60)
export const H6: Position = Position(61)
export const H7: Position = Position(62)
export const H8: Position = Position(63)
