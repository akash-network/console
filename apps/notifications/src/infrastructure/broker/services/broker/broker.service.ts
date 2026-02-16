import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import PgBoss from "pg-boss";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { BrokerConfig } from "@src/infrastructure/broker/config";
import { EventToPayload } from "./event-map";

type Event = {
  eventName: string;
  event: object;
};

export type SingleMsgWorkHandler<ReqData> = (job: PgBoss.Job<ReqData>) => Promise<any>;

@Injectable()
export class BrokerService {
  constructor(
    private readonly boss: PgBoss,
    private readonly pool: Pool,
    private readonly configService: ConfigService<BrokerConfig>,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(BrokerService.name);
  }

  async publish<T extends keyof EventToPayload>(eventName: T, event: EventToPayload[T], options?: PublishOptions) {
    if (options) {
      await this.boss.publish(eventName, event, options);
    } else {
      await this.boss.publish(eventName, event);
    }
    this.logger.log({ event: "EVENT_PUBLISHED", eventName });
  }

  async subscribe<ReqData>(eventName: string, options: { prefetchCount: number }, handler: SingleMsgWorkHandler<ReqData>) {
    const queueName = this.toQueueName(eventName);
    await this.boss.createQueue(queueName);
    await this.boss.subscribe(eventName, queueName);

    await Promise.all(
      Array.from({ length: options.prefetchCount }).map(() =>
        this.boss.work(queueName, async ([job]: PgBoss.Job<ReqData>[]) => {
          await handler(job);
        })
      )
    );
    this.logger.log({ event: "WORKER_STARTED", queueName, options });
  }

  async publishAll(events: Event[]) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      await Promise.all(
        events.map(async event =>
          this.boss.publish(event.eventName, event.event, {
            db: {
              executeSql(text: string, values: any[]): Promise<{ rows: any[] }> {
                return client.query(text, values);
              }
            }
          })
        )
      );
      this.logger.log({
        event: "EVENT_PUBLISHED",
        eventName: events.map(({ eventName }) => eventName)
      });

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private toQueueName(eventName: string) {
    return `${this.configService.getOrThrow("broker.APP_NAME")}.${eventName}`;
  }
}

export type PublishOptions = PgBoss.SendOptions;
