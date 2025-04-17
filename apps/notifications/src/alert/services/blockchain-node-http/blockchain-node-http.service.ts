import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Axios } from 'axios';

import { GlobalEnvConfig } from '@src/config/env.config';

@Injectable()
export class BlockchainNodeHttpService extends Axios {
  constructor(private readonly configService: ConfigService<GlobalEnvConfig>) {
    super({
      baseURL: configService.getOrThrow('API_NODE_ENDPOINT'),
    });
  }
}
