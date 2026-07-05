export interface AuthToken{
  readonly token:string
  readonly playerId:string,
  readonly issuedAt:number,
  readonly expiresAt:number
};

export interface AuthTokens {
  issue(playerId: string): Promise<AuthToken>;
  findByToken(token: string): Promise<AuthToken | null>; // null if unknown OR expired
  revoke(token: string): Promise<void>;
}