import type { Credentials, PasswordCredential } from "./credentials";
export class InMemoryCredentials implements Credentials {
  private byEmail = new Map<string, PasswordCredential>();
  private byPlayerId = new Map<string, PasswordCredential>();

  async findByPlayerId(playerId: string): Promise<PasswordCredential | null> {
    return this.byPlayerId.get(playerId) ?? null;
  }

  async findByEmail(email: string): Promise<PasswordCredential | null> {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }

  async save(credential: PasswordCredential): Promise<void> {
    const normalized: PasswordCredential = {
      ...credential,
      email: credential.email.toLowerCase(),
    };

    this.byEmail.set(normalized.email, normalized);
    this.byPlayerId.set(normalized.playerId, normalized);
  }
}
