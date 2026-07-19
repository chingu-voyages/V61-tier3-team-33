export interface OAuthIdentity {
  readonly playerId: string;
  readonly provider: "google";
  readonly providerSub: string;
  readonly email: string | null;
  readonly createdAt: number;
}

export interface OAuthIdentityRow {
  pid: string;
  provider: string;
  sub: string;
  email: string | null;
  created_at: Date;
}

export const OAuth = {
  fromRow(row: OAuthIdentityRow): OAuthIdentity {
    return {
      playerId: row.pid,
      provider: row.provider as "google",
      providerSub: row.sub,
      email: row.email,
      createdAt: row.created_at.getTime(),
    };
  },
};
