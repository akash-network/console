import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Axios, defaults } from 'axios';
import omit from 'lodash/omit';

import { GlobalEnvConfig } from '@src/config/env.config';

@Injectable()
export class BlockchainNodeHttpService extends Axios {
  constructor(private readonly configService: ConfigService<GlobalEnvConfig>) {
    super({
      ...omit(defaults, 'headers'),
      baseURL: configService.getOrThrow('API_NODE_ENDPOINT'),
    });
  }
}
