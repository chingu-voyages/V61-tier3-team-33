import { MoveClock } from "./move"
import { SWIFT } from "../../types"

export class SwiftClock extends MoveClock {
    readonly format = SWIFT
    readonly initialMs = 120_000
}
