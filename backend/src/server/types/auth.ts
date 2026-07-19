import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z
  .object({
    password: z.string().min(1),
  })
  .and(z.union([z.object({ login: z.string().min(1) }), z.object({ username: z.string().min(1) })]))
  .transform((d) => ({
    login: "login" in d ? d.login : d.username,
    password: d.password,
  }));

export const googleSchema = z.object({
  idToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;

/** Successful outcome of any auth flow: who they are, and their new auth token. */
export interface AuthSession {
  playerId: string;
  username: string;
  token: string;
}

/** Who a resolved session belongs to — enough to answer "who am I". */
export interface PlayerSummary {
  playerId: string;
  username: string;
  provider: string;
}
