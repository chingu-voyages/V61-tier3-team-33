import { MoveClock } from "./move"
import { BLITZ } from "../../types"

export class BlitzClock extends MoveClock {
    readonly format = BLITZ
    readonly initialMs = 60_000
}
