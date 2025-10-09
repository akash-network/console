import type { Auth0Config } from "@src/types/auth0";

export const auth0Config: Auth0Config = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "",
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "",
  clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  issuerBaseURL: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}`,
  routes: {
    login: "/auth/login",
    callback: "/auth/callback",
    postLogoutRedirect: "/"
  }
};

export const getAuth0Config = () => {
  if (!auth0Config.domain || !auth0Config.clientId) {
    throw new Error("Auth0 configuration is missing. Please check your environment variables.");
  }
  return auth0Config;
};

export const isAuth0Configured = (): boolean => {
  return !!(auth0Config.domain && auth0Config.clientId);
};
