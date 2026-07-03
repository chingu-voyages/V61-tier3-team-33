import { describe, expect, test } from "bun:test"
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "./session-storage"

// bun:test runs without a DOM by default, so `window` is undefined here —
// these calls exercise the SSR guard branch of every function. Browser
// (localStorage-present) behavior would need a jsdom/happy-dom
// environment, which this project doesn't configure yet.
describe("session-storage (no window)", () => {
  test("getStoredToken returns null when window is undefined", () => {
    expect(getStoredToken()).toBeNull()
  })

  test("setStoredToken is a no-op when window is undefined", () => {
    expect(() => setStoredToken("some-token")).not.toThrow()
  })

  test("clearStoredToken is a no-op when window is undefined", () => {
    expect(() => clearStoredToken()).not.toThrow()
  })
})
