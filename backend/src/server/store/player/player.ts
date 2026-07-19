import type { Brand } from "../../../chess/core/brand";
import { brandedTag } from "../../types";

/** How a player authenticates: guest (no login), password, or Google. */
export type AuthProvider = Brand<string, "AuthProvider">;
const AuthProviderTag = brandedTag<"AuthProvider">();
export const GUEST = AuthProviderTag("guest");
export const PASSWORD = AuthProviderTag("password");
export const GOOGLE = AuthProviderTag("google");

/** Visibility/privilege tier. */
export type PlayerRole = Brand<string, "PlayerRole">;
const PlayerRoleTag = brandedTag<"PlayerRole">();
export const ROLE_GUEST = PlayerRoleTag("guest");
export const ROLE_MEMBER = PlayerRoleTag("member");

/** Raw row from the `players` table. */
export interface PlayerRow {
  pid: string;
  username: string;
  role: string;
  provider: string;
  created_at: Date;
}

/** Domain player — pid is the identity, username is mutable. */
export interface Player {
  readonly pid: string;
  username: string;
  readonly createdAt: number;
  readonly role: PlayerRole;
  readonly provider: AuthProvider;
}

function generatePid(): string {
  return `p_${crypto.randomUUID().slice(0, 8).replace(/-/g, "")}`;
}

function randomHex(chars: number): string {
  const bytes = Math.ceil(chars / 2);
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, chars);
}

function validateUsername(username: string): void {
  if (!username || username.trim().length === 0) {
    throw new Error("Username must not be empty");
  }
}

export const Player = {
  create(username: string, provider: AuthProvider): Player {
    validateUsername(username);
    return {
      pid: generatePid(),
      username,
      createdAt: Date.now(),
      role: ROLE_MEMBER,
      provider,
    };
  },

  createGuest(): Player {
    return {
      pid: generatePid(),
      username: `Guest-${randomHex(4)}`,
      createdAt: Date.now(),
      role: ROLE_GUEST,
      provider: GUEST,
    };
  },

  fromRow(row: PlayerRow): Player {
    return {
      pid: row.pid,
      username: row.username,
      role: row.role as PlayerRole,
      provider: row.provider as AuthProvider,
      createdAt: row.created_at.getTime(),
    };
  },
};
