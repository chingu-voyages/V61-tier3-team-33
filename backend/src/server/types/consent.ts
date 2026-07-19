import { brandedTag } from "./chess";

/* Branded string literals for the ConsentManager state machine. */

const ConsentActionTag = brandedTag<"ConsentAction">();
export const CONSENT_REQUEST = ConsentActionTag("request");
export const CONSENT_ACCEPT = ConsentActionTag("accept");
export const CONSENT_DECLINE = ConsentActionTag("decline");
export const CONSENT_EXPIRE = ConsentActionTag("expire");

export type ConsentAction =
  typeof CONSENT_REQUEST | typeof CONSENT_ACCEPT | typeof CONSENT_DECLINE | typeof CONSENT_EXPIRE;
