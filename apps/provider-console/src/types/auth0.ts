export interface Auth0User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
  sub?: string;
  updated_at?: string;
}

export interface Auth0Session {
  user: Auth0User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  baseURL: string;
  issuerBaseURL: string;
  routes: {
    login: string;
    callback: string;
    postLogoutRedirect: string;
  };
}
