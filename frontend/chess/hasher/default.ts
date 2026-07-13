import type { IHasher } from "./hasher"
import { Zobrist } from "./zobrist"

const defaultHasher = new Zobrist()

export function getDefaultHasher(): IHasher {
  return defaultHasher
}
