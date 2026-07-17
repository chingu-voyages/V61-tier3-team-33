// types/auth.ts

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    playerId: string;
}
// types/auth.ts

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
  }
  export interface GoogleLoginRequest {
    idToken: string;
  }
  export interface RegisterResponse {
    playerId: string;
  }