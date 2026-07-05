import type {
    OAuthIdentity,
    OAuthIdentities,
  } from "./oauth-identities";
  
  export class InMemoryOAuthIdentities implements OAuthIdentities {
     private bySubject = new Map<string,  OAuthIdentity>();
        private byPlayerId = new Map<string,  OAuthIdentity>();
    
        async findByPlayerId(playerId: string): Promise< OAuthIdentity | null> {
            return this.byPlayerId.get(playerId) ?? null;
        }
    /**
 * C10: Finds a Google OAuth identity by provider subject.
 * Returns null if no matching identity exists.
 */
        async findBySubject(provider: "google",sub: string): Promise< OAuthIdentity | null> {
            return this.bySubject.get(sub)??null
        }
    
/**
 * C10: Saves the identity in both lookup maps.
 */
        async save(identity: OAuthIdentity): Promise<void> {

    
            this.bySubject.set(identity.providerSub, identity);
            this.byPlayerId.set(identity.playerId, identity);
  }}