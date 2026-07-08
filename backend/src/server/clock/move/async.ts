import { MoveClock } from "./move"
import { ASYNC } from "../../types"

export class AsyncClock extends MoveClock {
    readonly format = ASYNC
    readonly initialMs = 300_000
}
