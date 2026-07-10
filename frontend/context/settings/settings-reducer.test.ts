import { describe, expect, test } from "bun:test"
import { settingsReducer } from "./settings-reducer"

describe("settingsReducer", () => {
  const base = { activeSection: "general", mobileView: "list" as const }

  test("SET_SECTION updates activeSection", () => {
    const next = settingsReducer(base, { type: "SET_SECTION", payload: "appearance" })
    expect(next.activeSection).toBe("appearance")
    expect(next.mobileView).toBe("list")
  })

  test("SET_MOBILE_VIEW updates mobileView", () => {
    const next = settingsReducer(base, { type: "SET_MOBILE_VIEW", payload: "detail" })
    expect(next.mobileView).toBe("detail")
    expect(next.activeSection).toBe("general")
  })

  test("unknown action returns state unchanged", () => {
    const next = settingsReducer(base, { type: "UNKNOWN" as never, payload: "" })
    expect(next).toBe(base)
  })
})
