import type { Command } from "../protocol/commands";
import { JsonCodec } from "./json";

export interface Codec {
  decode(raw: unknown): Command | null;
  encode(message: unknown): string;
}

let current: Codec = new JsonCodec();

export function setCodec(codec: Codec): void {
  current = codec;
}

export function getCodec(): Codec {
  return current;
}
