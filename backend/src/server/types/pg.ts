export const PG_UNIQUE_VIOLATION = "23505";

export const PG_CONSTRAINT = {
  CREDS_PKEY: "creds_pkey",
  CREDS_EMAIL_IDX: "creds_email_idx",
  PLAYERS_USERNAME_IDX: "players_username_idx",
  OAUTH_PKEY: "oauth_pkey",
  OAUTH_PROVIDER_SUB_IDX: "oauth_provider_sub_key",
} as const;
