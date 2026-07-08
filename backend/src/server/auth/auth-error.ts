export type AuthErrorCode =
  | "INVALID_PAYLOAD" 
  | "EMAIL_TAKEN" 
  | "USERNAME_TAKEN"
  | "INVALID_CREDENTIALS" 
  | "INVALID_GOOGLE_TOKEN" 
  | "INTERNAL_ERROR";

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
  }
}