import { envConfig } from "./env.config";

export const config = {
  ...envConfig
};

export type Config = typeof config;
