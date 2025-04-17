import { SetMetadata } from '@nestjs/common';

import type { HandlerConfig } from '../services/pg-boss-handler/pg-boss-handler.service';

export const PG_BOSS_HANDLER = Symbol('PG_BOSS_HANDLER');

export const Handler = (config: Omit<HandlerConfig<unknown>, 'handler'>) =>
  SetMetadata(PG_BOSS_HANDLER, config);
