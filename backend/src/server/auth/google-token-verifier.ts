export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleProfile | null>;
}
export class HttpGoogleTokenVerifier implements GoogleTokenVerifier {
  constructor(private clientId: string) {}

  async verify(idToken: string): Promise<GoogleProfile | null> {
    if (!this.clientId) {
      return null;
    }

    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as Record<string, unknown>;

      if (data.aud !== this.clientId) {
        return null;
      }

      return {
        sub: String(data.sub ?? ""),
        email: String(data.email ?? ""),
        emailVerified: String(data.email_verified ?? "") === "true",
      };
    } catch {
      return null;
    }
  }
}
