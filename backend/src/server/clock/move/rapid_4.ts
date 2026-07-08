import { MoveClock } from "./move"
import { RAPID_4 } from "../../types"

export class Rapid4Clock extends MoveClock {
    readonly format = RAPID_4
    readonly initialMs = 240_000
}
