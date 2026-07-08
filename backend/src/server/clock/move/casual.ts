import { MoveClock } from "./move"
import { CASUAL } from "../../types"

export class CasualClock extends MoveClock {
    readonly format = CASUAL
    readonly initialMs = 600_000
}
