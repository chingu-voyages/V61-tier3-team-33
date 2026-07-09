export interface GoogleProfile {
    sub: string;
    email: string;
    emailVerified: boolean;
}

export interface GoogleTokenVerifier {
    verify(idToken: string): Promise<GoogleProfile | null>;
}
export class HttpGoogleTokenVerifier
    implements GoogleTokenVerifier {

    constructor(
        private clientId: string
    ) {}

    async verify(idToken: string): Promise<GoogleProfile | null> {
        if (!this.clientId) {
            return null;
        }
    
        try {
            const response = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
            );
    
            if (!response.ok) {
                return null;
            }
    
            const data: any = await response.json();
    
            if (data.aud !== this.clientId) {
                return null;
            }
    
            return {
                sub: data.sub,
                email: data.email,
                emailVerified: data.email_verified === "true",
            };
        } catch {
            return null;
        }
    }
}