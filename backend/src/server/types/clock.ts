import type { Brand } from "./chess";

export type ClockType = Brand<string, "ClockType">;
export const ClockType = (value: string): ClockType => value as ClockType;

export const MOVE = ClockType("move");
export const MATCH = ClockType("match");

export type ClockFormat = Brand<string, "ClockFormat">;
export const ClockFormat = (value: string): ClockFormat => value as ClockFormat;

export const DEFAULT  = ClockFormat("default");
export const BULLET   = ClockFormat("bullet");
export const RAPID_2  = ClockFormat("rapid_2");
export const RAPID_3  = ClockFormat("rapid_3");
export const RAPID_4  = ClockFormat("rapid_4");
export const BLITZ    = ClockFormat("blitz");
export const ASYNC    = ClockFormat("async");
