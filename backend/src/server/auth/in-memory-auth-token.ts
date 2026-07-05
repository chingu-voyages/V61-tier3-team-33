import type { AuthTokens, AuthToken } from "./auth-token";
// Q2 Decision: 30 days fixed expiry duration in milliseconds
const AUTH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export class InMemoryAuthToken implements AuthTokens {
    private byToken = new Map<string, AuthToken>();

   async issue(playerId: string): Promise<AuthToken> {
        // C14: Ensure distinct/unique tokens using standard crypto
        const token = crypto.randomUUID();
        const issuedAt = Date.now();

        // C11: expiresAt must equal issuedAt + TTL
        const expiresAt = issuedAt + AUTH_TOKEN_TTL_MS;

        const authToken: AuthToken = {
            token,
            playerId,
            issuedAt,
            expiresAt,
        };

        this.byToken.set(token, authToken);
        return authToken;
    };
   async findByToken(token: string): Promise<AuthToken | null> {
        const record = this.byToken.get(token);
        if (!record) {
            return null;
        }
       // C12: Expiry check lives inside findByToken. Callers never see stale records.
    if (Date.now() > record.expiresAt) {
        this.byToken.delete(token); // Self-cleaning step
        return null;
      }
        return record;


    }
   async revoke(token: string): Promise<void> {
        this.byToken.delete(token)
    }
}