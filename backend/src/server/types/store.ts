import type { Brand } from "../../chess/core/brand";
import { brandedTag } from "./chess";

export type StoreKind = Brand<string, "StoreKind">;
const StoreKindTag = brandedTag<"StoreKind">();
export const MEMORY: StoreKind = StoreKindTag("memory");
export const POSTGRES: StoreKind = StoreKindTag("postgres");
