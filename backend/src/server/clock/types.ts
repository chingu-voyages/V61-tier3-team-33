import type { Brand } from "../../chess/core/brand";

/**
 * Whether a clock resets per move ("move") or ticks down across the whole game ("match").
 * Add new values here as needed.
 */
export type ClockType = Brand<string, "ClockType">;
export const ClockType = (value: string): ClockType => value as ClockType;

export const MOVE = ClockType("move");
export const MATCH = ClockType("match");

/**
 * Named format identifier passed to `createClock(format)`.
 * Every strategy must define its own format constant here so the factory can dispatch on it.
 */
export type ClockFormat = Brand<string, "ClockFormat">;
export const ClockFormat = (value: string): ClockFormat => value as ClockFormat;

// Add your format constants here when implementing a new strategy.
// Example: export const BLITZ = ClockFormat("blitz");
export const DEFAULT = ClockFormat("default");
