import { createHttpClient, DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AlertConfig } from "@src/modules/alert/config";

export const HTTP_SDK_PROVIDERS: Provider[] = [
  {
    provide: DeploymentHttpService,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AlertConfig>) =>
      new DeploymentHttpService(
        createHttpClient({
          baseURL: configService.getOrThrow("alert.API_NODE_ENDPOINT")
        })
      )
  },
  {
    provide: LeaseHttpService,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AlertConfig>) =>
      new LeaseHttpService({
        baseURL: configService.getOrThrow("alert.API_NODE_ENDPOINT")
      })
  }
];
