import { describe, expect, it } from "bun:test"
import { createClock } from "../factory"
import { BULLET, RAPID_2, RAPID_3, RAPID_4, BLITZ, ASYNC, MOVE } from "../../types"

describe("BulletClock", () => {
    it("resets to 1 min on each move", () => {
        const c = createClock(BULLET)
        expect(c.initialMs).toBe(60_000)
        expect(c.type).toBe(MOVE)
        expect(c.onMove(30_000, 10_000)).toBe(60_000)
    })
    it("has no turn delay", () => {
        expect(createClock(BULLET).onTurn()).toBe(0)
    })
})

describe("Rapid2Clock", () => {
    it("resets to 2 min on each move", () => {
        const c = createClock(RAPID_2)
        expect(c.initialMs).toBe(120_000)
        expect(c.onMove(60_000, 10_000)).toBe(120_000)
    })
})

describe("Rapid3Clock", () => {
    it("resets to 3 min on each move", () => {
        const c = createClock(RAPID_3)
        expect(c.initialMs).toBe(180_000)
        expect(c.onMove(60_000, 10_000)).toBe(180_000)
    })
})

describe("Rapid4Clock", () => {
    it("resets to 4 min on each move", () => {
        const c = createClock(RAPID_4)
        expect(c.initialMs).toBe(240_000)
        expect(c.onMove(60_000, 10_000)).toBe(240_000)
    })
})

describe("BlitzClock", () => {
    it("resets to 5 min on each move", () => {
        const c = createClock(BLITZ)
        expect(c.initialMs).toBe(300_000)
        expect(c.onMove(60_000, 10_000)).toBe(300_000)
    })
    it("is the default when no format given", () => {
        expect(createClock().initialMs).toBe(300_000)
    })
})

describe("AsyncClock", () => {
    it("has 5 min inactivity limit", () => {
        const c = createClock(ASYNC)
        expect(c.initialMs).toBe(300_000)
        expect(c.onMove(100_000, 50_000)).toBe(300_000)
    })
})
