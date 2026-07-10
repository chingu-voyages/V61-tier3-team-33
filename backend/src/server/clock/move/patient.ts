import { MoveClock } from "./move"
import { PATIENT } from "../../types"

export class PatientClock extends MoveClock {
    readonly format = PATIENT
    readonly initialMs = 300_000
}
