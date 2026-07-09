import { createPlayer } from "../players/player";
import type { Players } from "../players/players";
import type { Credentials } from "../players/credential/credentials";
import type { OAuthIdentities } from "../players/credential/Oauth/oauth-identities";
import type { AuthTokens } from "./auth-token";
import type { GoogleTokenVerifier } from "./google-token-verifier";
import { AuthError } from "./auth-error";

export interface RestAuthenticator {
  register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ playerId: string; authToken: string }>;

  login(input: {
    email: string;
    password: string;
  }): Promise<{ playerId: string; authToken: string }>;

  loginWithGoogle(
    idToken: string
  ): Promise<{ playerId: string; authToken: string }>;
}

export class DefaultRestAuthenticator implements RestAuthenticator {
  constructor(
    private players: Players,
    private credentials: Credentials,
    private identities: OAuthIdentities,
    private authTokens: AuthTokens,
    private verifier: GoogleTokenVerifier,
  ) {}

  async register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ playerId: string; authToken: string }> {
    const trimmedUsername = input.username?.trim() ?? "";
    const email = input.email?.trim() ?? "";
    const password = input.password ?? "";

    // C15: Validate input payload
    const isUsernameValid = trimmedUsername.length >= 3 && trimmedUsername.length <= 20;
    const isPasswordValid = password.length >= 8;
    const isEmailValid = email.includes("@") && email.indexOf(".", email.indexOf("@")) > -1;

    if (!isUsernameValid || !isPasswordValid || !isEmailValid) {
      throw new AuthError("INVALID_PAYLOAD", "Invalid username, email, or password format.");
    }

    // C9 & C16: Case-insensitive email check
    const normalizedEmail = email.toLowerCase();
    const existingCreds = await this.credentials.findByEmail(normalizedEmail);
    if (existingCreds) {
      throw new AuthError("EMAIL_TAKEN", "Email is already registered.");
    }

    // C17: Username uniqueness check
    const existingPlayer = await this.players.findByUsername(trimmedUsername);
    if (existingPlayer) {
      throw new AuthError("USERNAME_TAKEN", "Username is already taken.");
    }

    // C18 & C19: Hash password using Bun's built-in argon2id matching contracts
    const passwordHash = await Bun.password.hash(password, {
      algorithm: "argon2id"
    });

    // Create and save Player identity
    const player = createPlayer(trimmedUsername, "password");
    await this.players.save(player);

    // Save credentials bound to the player
    await this.credentials.save({
      playerId: player.id,
      email: normalizedEmail,
      passwordHash,
      createdAt: Date.now()
    });

    // Issue the 30-day authToken
    const authTokenRecord = await this.authTokens.issue(player.id);

    return {
      playerId: player.id,
      authToken: authTokenRecord.token
    };
  }

  async login(input: { email: string; password: string }): Promise<{ playerId: string; authToken: string }> {
    // To be implemented next
    const normalizedEmail=input.email.trim().toLowerCase();
    const verifiedEmail=await this.credentials.findByEmail(normalizedEmail)

    if(!verifiedEmail){
      throw new AuthError("INVALID_CREDENTIALS","Email doesn't exists")
    }
    const verifiedPassword=await Bun.password.verify(input.password,verifiedEmail.passwordHash )
    if(!verifiedPassword){
      throw new AuthError("INVALID_CREDENTIALS")
    }
    const player=await this.players.findById(verifiedEmail.playerId)
    if(!player){
      console.warn("Credential exists but player is missing");
      throw new AuthError("INTERNAL_ERROR")
    }

    const authToken=await this.authTokens.issue(player.id);
    
    return {
      playerId:player.id,
      authToken:authToken.token

    }
  }

  async loginWithGoogle(
    idToken: string
  ): Promise<{ playerId: string; authToken: string }> {

    const profile = await this.verifier.verify(idToken);

    if (!profile || !profile.emailVerified) {
        throw new AuthError("INVALID_GOOGLE_TOKEN");
    }

    const identity = await this.identities.findBySubject(
        "google",
        profile.sub
    );

    if (identity) {
        const authToken = await this.authTokens.issue(identity.playerId);

        return {
            playerId: identity.playerId,
            authToken: authToken.token,
        };
    }

    if (!profile.email) {
        throw new AuthError("INVALID_GOOGLE_TOKEN");
    }

    // Fix TS error by ensuring baseUsername is guaranteed to be a string
    const baseUsername = profile.email.split("@")[0] || "google-user";
    let username = baseUsername;

    // C27: Loop and auto-append a short suffix if the username collides
    while (await this.players.findByUsername(username)) {
        // Bun ships with crypto built-in
        const suffix = crypto.randomUUID().slice(0, 4);
        username = `${baseUsername}-${suffix}`;
    }

    const player = createPlayer(username, "google");
    await this.players.save(player);

    await this.identities.save({
        playerId: player.id,
        provider: "google",
        providerSub: profile.sub,
        email: profile.email,
        createdAt: Date.now(),
    });

    const authToken = await this.authTokens.issue(player.id);

    return {
        playerId: player.id,
        authToken: authToken.token,
    };
  }
}