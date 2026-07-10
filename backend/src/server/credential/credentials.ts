export interface PasswordCredential {
    readonly playerId: string;
    readonly email: string;
    readonly passwordHash: string;
    readonly createdAt: number;
}
export interface Credentials {
    findByEmail(email: string): Promise<PasswordCredential | null>;

    findByPlayerId(playerId: string): Promise<PasswordCredential | null>;

    save(credential: PasswordCredential): Promise<void>;
}