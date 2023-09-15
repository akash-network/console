import dotenv from "dotenv";
dotenv.config();

export const env = {
  SentryDSN: process.env.SentryDSN,
  AKASHLYTICS_CORS_WEBSITE_URLS: process.env.AKASHLYTICS_CORS_WEBSITE_URLS,
  NODE_ENV: process.env.NODE_ENV,
  SentryServerName: process.env.SentryServerName,
  HealthchecksEnabled: process.env.HealthchecksEnabled,
  AkashDatabaseCS: process.env.AkashDatabaseCS,
  AkashTestnetDatabaseCS: process.env.AkashTestnetDatabaseCS,
  AkashSandboxDatabaseCS: process.env.AkashSandboxDatabaseCS,
  UserDatabaseCS: process.env.UserDatabaseCS,
  Network: process.env.Network ?? "mainnet",
  RestApiNodeUrl: process.env.RestApiNodeUrl,
  AkashlyticsGithubPAT: process.env.AkashlyticsGithubPAT,
  Auth0JWKSUri: process.env.Auth0JWKSUri,
  Auth0Audience: process.env.Auth0Audience,
  Auth0Issuer: process.env.Auth0Issuer,
  WebsiteUrl: process.env.WebsiteUrl,
  SecretToken: process.env.SecretToken
};
