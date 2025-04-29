import { envConfig } from "./env.config";
import { USDC_IBC_DENOMS } from "./network.config";

export const appConfig = {
  USDC_IBC_DENOMS
};

export const config = {
  ...envConfig,
  ...appConfig
};
