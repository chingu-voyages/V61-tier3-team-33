import { createContext } from "react";

export interface User {
  playerId: string;
  username: string;
  provider: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext =
    createContext<AuthContextType>(null!);