import dotenv from "dotenv";
dotenv.config();

export const env = {
  HealthChecks_SyncBlocks: process.env.HealthChecks_SyncBlocks,
  HealthChecks_SyncAKTPriceHistory: process.env.HealthChecks_SyncAKTPriceHistory,
  HealthChecks_SyncProviderInfo: process.env.HealthChecks_SyncProviderInfo,
  HealthChecks_SyncKeybaseInfo: process.env.HealthChecks_SyncKeybaseInfo,
  SentryDSN: process.env.SentryDSN,
  NODE_ENV: process.env.NODE_ENV,
  SentryServerName: process.env.SentryServerName,
  HealthchecksEnabled: process.env.HealthchecksEnabled,
  AkashDatabaseCS: process.env.AkashDatabaseCS,
  PassageDatabaseCS: process.env.PassageDatabaseCS,
  JunoDatabaseCS: process.env.JunoDatabaseCS,
  ActiveChain: process.env.ActiveChain,
  KeepCache: process.env.KeepCache === "true",
  Standby: process.env.Standby === "true"
};
