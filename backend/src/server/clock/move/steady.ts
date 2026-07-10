import { MoveClock } from "./move"
import { STEADY } from "../../types"

export class SteadyClock extends MoveClock {
    readonly format = STEADY
    readonly initialMs = 180_000
}
