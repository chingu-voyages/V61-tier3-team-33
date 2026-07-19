import {
  EMAIL_TAKEN,
  INTERNAL_ERROR,
  INVALID_CREDENTIALS,
  INVALID_GOOGLE_TOKEN,
  INVALID_PAYLOAD,
  NOT_AUTHENTICATED,
  USERNAME_TAKEN,
} from "../types/result";
import type { AuthError } from "./result";

export const Status = {
  auth(error: AuthError): number {
    switch (error) {
      case INVALID_PAYLOAD:
        return 400;
      case NOT_AUTHENTICATED:
      case INVALID_CREDENTIALS:
      case INVALID_GOOGLE_TOKEN:
        return 401;
      case EMAIL_TAKEN:
      case USERNAME_TAKEN:
        return 409;
      case INTERNAL_ERROR:
        return 500;
    }
    throw new Error(`Unmapped AuthError: ${error}`);
  },
};
