import { MoveClock } from "./move"
import { RAPID_3 } from "../../types"

export class Rapid3Clock extends MoveClock {
    readonly format = RAPID_3
    readonly initialMs = 180_000
}
