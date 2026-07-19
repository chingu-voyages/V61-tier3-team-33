export interface AuthToken {
  readonly token: string;
  readonly playerId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface AuthTokenRow {
  token: string;
  pid: string;
  issued_at: Date;
  expires_at: Date;
}

export const Token = {
  fromRow(row: AuthTokenRow): AuthToken {
    return {
      token: row.token,
      playerId: row.pid,
      issuedAt: row.issued_at.getTime(),
      expiresAt: row.expires_at.getTime(),
    };
  },
};
