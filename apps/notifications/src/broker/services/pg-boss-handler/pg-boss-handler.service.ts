import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable } from '@nestjs/common';
import { validate, ZodDto } from 'nestjs-zod';
import PgBoss from 'pg-boss';

import { LoggerService } from '@src/common/services/logger.service';
import { PG_BOSS_HANDLER } from '../../decorators/handler.decorator';
import { BrokerService } from '../broker/broker.service';

export interface HandlerConfig<T> {
  key: string;
  dto: ZodDto<T>;
  handler: (message: PgBoss.Job<T>['data']) => Promise<void>;
}

@Injectable()
export class PgBossHandlerService {
  static isInitialized = false;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly broker: BrokerService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(PgBossHandlerService.name);
  }

  async startAllHandlers() {
    if (PgBossHandlerService.isInitialized) {
      return;
    }
    PgBossHandlerService.isInitialized = true;

    const methods =
      await this.discoveryService.providerMethodsWithMetaAtKey<
        HandlerConfig<unknown>
      >(PG_BOSS_HANDLER);

    const handleAll = methods.map(async ({ meta, discoveredMethod }) => {
      await this.handle({
        ...meta,
        handler: discoveredMethod.handler.bind(
          discoveredMethod.parentClass.instance,
        ),
      });
    });

    await Promise.all(handleAll);
  }

  private async handle<T>(config: HandlerConfig<T>) {
    await this.broker.subscribe(
      config.key,
      { prefetchCount: 10 },
      async (job) => {
        try {
          const msg = validate(job.data, config.dto);
          await config.handler(msg);
          this.loggerService.log({
            event: 'MESSAGE_WORKER_SUCCESS',
            key: config.key,
          });
        } catch (error) {
          this.loggerService.error({
            event: 'MESSAGE_WORKER_FAILURE',
            key: config.key,
            job,
            error,
          });
          throw error;
        }
      },
    );
  }
}
