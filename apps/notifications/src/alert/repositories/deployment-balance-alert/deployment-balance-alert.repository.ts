import { InjectDrizzle } from '@knaadh/nestjs-drizzle-pg';
import { Injectable } from '@nestjs/common';
import { and, eq, gt, lte } from 'drizzle-orm';
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
      operator: z.union([z.literal('eq'), z.literal('lt')]),
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ]),
);

export type Conditions = z.infer<typeof conditionSchema>;

type InternalAlertOutput = typeof schema.DeploymentBalanceAlert.$inferSelect;
export type DeploymentBalanceAlertOutput = Omit<
  InternalAlertOutput,
  'conditions'
> & {
  conditions: Conditions;
};

@Injectable()
export class DeploymentBalanceAlertRepository {
  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async updateById(
    id: string,
    alert: Partial<DeploymentBalanceAlertOutput>,
  ): Promise<void> {
    await this.db
      .update(schema.DeploymentBalanceAlert)
      .set(alert)
      .where(eq(schema.DeploymentBalanceAlert.id, id));
  }

  async paginate({
    query,
    limit,
    callback,
  }: {
    query: { block: number };
    limit: number;
    callback: (alerts: DeploymentBalanceAlertOutput[]) => Promise<void> | void;
  }): Promise<void> {
    let lastId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const cursor = this.db
        .select()
        .from(schema.DeploymentBalanceAlert)
        .orderBy(schema.DeploymentBalanceAlert.id)
        .limit(limit);

      const clauses = [
        lte(schema.DeploymentBalanceAlert.minBlockHeight, query.block),
        eq(schema.DeploymentBalanceAlert.enabled, true),
      ];

      if (lastId) {
        clauses.push(gt(schema.DeploymentBalanceAlert.id, lastId));
      }

      cursor.where(and(...clauses));
      const batch = await cursor;

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

  private toOutputList(
    alerts: InternalAlertOutput[],
  ): DeploymentBalanceAlertOutput[] {
    return alerts.map(this.toOutput);
  }

  private toOutput(alert: InternalAlertOutput): DeploymentBalanceAlertOutput {
    return {
      ...alert,
      conditions: conditionSchema.parse(alert.conditions),
    };
  }
}
