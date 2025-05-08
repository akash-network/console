import { ConfigurableModuleBuilder } from '@nestjs/common';

export type BrokerModuleConfig = {
  appName: string;
  postgresUri: string;
};

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<BrokerModuleConfig>().build();
