import { describe, expect, test } from "bun:test"
import { cn } from "./utils"

describe("cn", () => {
  test("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2")
  })

  test("handles conditional classes", () => {
    expect(cn("px-4", false && "hidden")).toBe("px-4")
    expect(cn("px-4", true && "block")).toBe("px-4 block")
  })

  test("resolves conflicts (last wins)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6")
  })

  test("handles undefined and null", () => {
    expect(cn("px-4", undefined, null)).toBe("px-4")
  })
})
