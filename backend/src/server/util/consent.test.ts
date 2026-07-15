import { describe, expect, it } from "bun:test";

import { CONSENT_ACCEPT, CONSENT_DECLINE, CONSENT_EXPIRE, CONSENT_REQUEST } from "../types/consent";
import { ConsentManager } from "./consent";

describe("ConsentManager", () => {
  it("allows request when idle", () => {
    const cm = new ConsentManager<string, string>();
    expect(cm.transition("game-1", CONSENT_REQUEST, "white")).toBe(true);
    expect(cm.isPending("game-1")).toBe(true);
    expect(cm.requester("game-1")).toBe("white");
  });

  it("rejects request when already pending", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    expect(cm.transition("game-1", CONSENT_REQUEST, "black")).toBe(false);
  });

  it("allows accept when pending by opponent", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    expect(cm.transition("game-1", CONSENT_ACCEPT, "black")).toBe(true);
    expect(cm.isPending("game-1")).toBe(false);
  });

  it("rejects accept when same player as requester", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    expect(cm.transition("game-1", CONSENT_ACCEPT, "white")).toBe(false);
    expect(cm.isPending("game-1")).toBe(true);
  });

  it("rejects accept when no pending request", () => {
    const cm = new ConsentManager<string, string>();
    expect(cm.transition("game-1", CONSENT_ACCEPT, "black")).toBe(false);
  });

  it("allows decline when pending by opponent", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    expect(cm.transition("game-1", CONSENT_DECLINE, "black")).toBe(true);
    expect(cm.isPending("game-1")).toBe(false);
  });

  it("rejects decline when same player as requester", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    expect(cm.transition("game-1", CONSENT_DECLINE, "white")).toBe(false);
  });

  it("clears pending request", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    cm.clear("game-1");
    expect(cm.isPending("game-1")).toBe(false);
    expect(cm.requester("game-1")).toBeNull();
  });

  it("returns null for requester when idle", () => {
    const cm = new ConsentManager<string, string>();
    expect(cm.requester("game-1")).toBeNull();
    expect(cm.isPending("game-1")).toBe(false);
  });

  it("different keys are independent", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    cm.transition("game-2", CONSENT_REQUEST, "black");
    expect(cm.requester("game-1")).toBe("white");
    expect(cm.requester("game-2")).toBe("black");
    cm.clear("game-1");
    expect(cm.isPending("game-1")).toBe(false);
    expect(cm.isPending("game-2")).toBe(true);
  });

  it("allows expire when pending, clears the entry", () => {
    const cm = new ConsentManager<string, string>();
    cm.transition("game-1", CONSENT_REQUEST, "white");
    expect(cm.transition("game-1", CONSENT_EXPIRE, "black")).toBe(true);
    expect(cm.isPending("game-1")).toBe(false);
    expect(cm.requester("game-1")).toBeNull();
  });

  it("rejects expire when no pending request", () => {
    const cm = new ConsentManager<string, string>();
    expect(cm.transition("game-1", CONSENT_EXPIRE, "black")).toBe(false);
  });

  it("clear on an idle key is a no-op", () => {
    const cm = new ConsentManager<string, string>();
    expect(() => cm.clear("game-1")).not.toThrow();
  });
});
