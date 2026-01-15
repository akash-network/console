import type { HttpClient } from "@akashnetwork/http-sdk";
import { BalanceHttpService, createHttpClient, DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import type { InjectionToken, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AlertConfig } from "@src/modules/alert/config";

export const CHAIN_API_HTTP_CLIENT_TOKEN: InjectionToken<HttpClient> = Symbol("CHAIN_API_HTTP_CLIENT");

export const HTTP_SDK_PROVIDERS: Provider[] = [
  {
    provide: CHAIN_API_HTTP_CLIENT_TOKEN,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AlertConfig>) =>
      createHttpClient({
        baseURL: configService.getOrThrow("alert.API_NODE_ENDPOINT"),
        adapter: "http"
      })
  },
  {
    provide: DeploymentHttpService,
    inject: [CHAIN_API_HTTP_CLIENT_TOKEN],
    useFactory: (httpClient: HttpClient) => new DeploymentHttpService(httpClient)
  },
  {
    provide: LeaseHttpService,
    inject: [CHAIN_API_HTTP_CLIENT_TOKEN],
    useFactory: (httpClient: HttpClient) => new LeaseHttpService(httpClient)
  },
  {
    provide: BalanceHttpService,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<AlertConfig>) => new BalanceHttpService({ baseURL: configService.getOrThrow("alert.API_NODE_ENDPOINT") })
  }
];
