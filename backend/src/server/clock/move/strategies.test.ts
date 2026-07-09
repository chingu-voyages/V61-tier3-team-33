import { describe, expect, it } from "bun:test"
import { createClock } from "../factory"
import { BULLET, BLITZ, SWIFT, STEADY, PATIENT, CASUAL, MOVE } from "../../types"

describe("BulletClock", () => {
    it("resets to 30s on each move", () => {
        const c = createClock(BULLET)
        expect(c.initialMs).toBe(30_000)
        expect(c.type).toBe(MOVE)
        expect(c.onMove(15_000, 10_000)).toBe(30_000)
    })
    it("has no turn delay", () => {
        expect(createClock(BULLET).onTurn()).toBe(0)
    })
})

describe("BlitzClock", () => {
    it("resets to 1 min on each move", () => {
        const c = createClock(BLITZ)
        expect(c.initialMs).toBe(60_000)
        expect(c.onMove(30_000, 10_000)).toBe(60_000)
    })
    it("is the default when no format given", () => {
        expect(createClock().initialMs).toBe(60_000)
    })
})

describe("SwiftClock", () => {
    it("resets to 2 min on each move", () => {
        const c = createClock(SWIFT)
        expect(c.initialMs).toBe(120_000)
        expect(c.onMove(60_000, 10_000)).toBe(120_000)
    })
    it("has no turn delay", () => {
        expect(createClock(SWIFT).onTurn()).toBe(0)
    })
})

describe("SteadyClock", () => {
    it("resets to 3 min on each move", () => {
        const c = createClock(STEADY)
        expect(c.initialMs).toBe(180_000)
        expect(c.onMove(60_000, 10_000)).toBe(180_000)
    })
    it("has no turn delay", () => {
        expect(createClock(STEADY).onTurn()).toBe(0)
    })
})

describe("PatientClock", () => {
    it("resets to 5 min on each move", () => {
        const c = createClock(PATIENT)
        expect(c.initialMs).toBe(300_000)
        expect(c.onMove(60_000, 10_000)).toBe(300_000)
    })
    it("has no turn delay", () => {
        expect(createClock(PATIENT).onTurn()).toBe(0)
    })
})

describe("CasualClock", () => {
    it("forfeits after 10 min of inactivity", () => {
        const c = createClock(CASUAL)
        expect(c.initialMs).toBe(600_000)
        expect(c.onMove(300_000, 50_000)).toBe(600_000)
    })
    it("has no turn delay", () => {
        expect(createClock(CASUAL).onTurn()).toBe(0)
    })
})
