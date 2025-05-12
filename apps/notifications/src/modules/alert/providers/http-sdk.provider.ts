import { DeploymentHttpService } from '@akashnetwork/http-sdk';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GlobalEnvConfig } from '@src/config/env.config';

export const HTTP_SDK_PROVIDERS: Provider[] = [
  {
    provide: DeploymentHttpService,
    inject: [ConfigService],
    useFactory: (configService: ConfigService<GlobalEnvConfig>) =>
      new DeploymentHttpService({
        baseURL: configService.getOrThrow('API_NODE_ENDPOINT'),
      }),
  },
];
