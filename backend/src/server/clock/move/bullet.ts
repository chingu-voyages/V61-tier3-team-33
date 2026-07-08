import { MoveClock } from "./move"
import { BULLET } from "../../types"

export class BulletClock extends MoveClock {
    readonly format = BULLET
    readonly initialMs = 30_000
}
