import { InjectDrizzle } from '@knaadh/nestjs-drizzle-pg';
import { Injectable } from '@nestjs/common';
import { gt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { z } from 'zod';

import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import * as schema from '../../model-schemas';

const conditionSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({
      operator: z.literal('and'),
      value: z.array(conditionSchema),
    }),
    z.object({
      operator: z.literal('or'),
      value: z.array(conditionSchema),
    }),

    z.object({
      operator: z.literal('eq'),
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ]),
);

export type Conditions = z.infer<typeof conditionSchema>;

type InternalAlertOutput = typeof schema.RawAlert.$inferSelect;
export type AlertOutput = Omit<InternalAlertOutput, 'eventConditions'> & {
  eventConditions: Conditions;
};

@Injectable()
export class RawAlertRepository {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async paginate({
    limit,
    callback,
  }: {
    limit: number;
    callback: (alert: AlertOutput[]) => Promise<void> | void;
  }): Promise<void> {
    let lastId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const query = this.db
        .select()
        .from(schema.RawAlert)
        .orderBy(schema.RawAlert.id)
        .limit(limit);

      if (lastId) {
        query.where(gt(schema.RawAlert.id, lastId));
      }

      const batch = await query;

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      await callback(this.toOutputList(batch));

      lastId = batch[batch.length - 1].id;

      if (batch.length < limit) {
        hasMore = false;
      }
    }
  }

  private toOutputList(alerts: InternalAlertOutput[]): AlertOutput[] {
    return alerts.map(this.toOutput);
  }

  private toOutput(alert: InternalAlertOutput): AlertOutput {
    return {
      ...alert,
      eventConditions: conditionSchema.parse(alert.conditions),
    };
  }
}
