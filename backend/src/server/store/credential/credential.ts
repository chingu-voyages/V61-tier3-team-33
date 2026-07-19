/** Domain credential — one per player, insert-only (all readonly). */
export interface PasswordCredential {
  readonly playerId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: number;
}

/** Raw row from the `creds` table. */
export interface PasswordCredentialRow {
  pid: string;
  email: string;
  hash: string;
  created_at: Date;
}

export const Credential = {
  /** Map a PG row to the domain model (timestamp → ms). */
  fromRow(row: PasswordCredentialRow): PasswordCredential {
    return {
      playerId: row.pid,
      email: row.email,
      passwordHash: row.hash,
      createdAt: row.created_at.getTime(),
    };
  },
};
