export interface OAuthIdentity {
  readonly playerId: string;
  readonly provider: "google";
  readonly providerSub: string;
  readonly email: string | null;
  readonly createdAt: number;
}

export interface OAuthIdentities {
  findBySubject(provider: "google", sub: string): Promise<OAuthIdentity | null>;

  findByPlayerId(playerId: string): Promise<OAuthIdentity | null>;

  save(identity: OAuthIdentity): Promise<void>;
}
