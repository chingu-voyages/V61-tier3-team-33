import type { Brand } from "./chess";

export type ClockType = Brand<string, "ClockType">;
export const ClockType = (value: string): ClockType => value as ClockType;

export const MOVE = ClockType("move");
export const MATCH = ClockType("match");

export type ClockFormat = Brand<string, "ClockFormat">;
export const ClockFormat = (value: string): ClockFormat => value as ClockFormat;

export const DEFAULT = ClockFormat("default");
