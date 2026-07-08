import { MoveClock } from "./move"
import { RAPID_2 } from "../../types"

export class Rapid2Clock extends MoveClock {
    readonly format = RAPID_2
    readonly initialMs = 120_000
}
