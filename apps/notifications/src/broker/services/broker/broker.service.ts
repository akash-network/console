import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'pg';
import PgBoss from 'pg-boss';

import {
  BrokerModuleConfig,
  MODULE_OPTIONS_TOKEN,
} from '@src/broker/broker-module.definition';
import { LoggerService } from '@src/common/services/logger.service';

type EventPayload = object;

type Event = {
  eventName: string;
  event: object;
};

@Injectable()
export class BrokerService {
  constructor(
    private readonly boss: PgBoss,
    private readonly pg: Client,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly brokerModuleConfig: BrokerModuleConfig,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(BrokerService.name);
  }

  async publish(eventName: string, event: EventPayload) {
    await this.boss.publish(eventName, event);
  }

  async subscribe<ReqData>(
    eventName: string,
    options: { prefetchCount: number },
    handler: PgBoss.WorkHandler<ReqData>,
  ) {
    const queueName = this.toQueueName(eventName);
    await this.boss.createQueue(queueName);
    await this.boss.subscribe(eventName, queueName);

    await Promise.all(
      Array.from({ length: options.prefetchCount }).map(() =>
        this.boss.work(queueName, handler),
      ),
    );
  }

  async publishAll(events: Event[]) {
    try {
      await this.pg.query('BEGIN');

      await Promise.all(
        events.map(async (event) =>
          this.boss.publish(event.eventName, event.event),
        ),
      );

      await this.pg.query('COMMIT');
    } catch (error: unknown) {
      await this.pg.query('ROLLBACK');
      throw error;
    }
  }

  private toQueueName(eventName: string) {
    return `${this.brokerModuleConfig.appName}.${eventName}`;
  }
}
