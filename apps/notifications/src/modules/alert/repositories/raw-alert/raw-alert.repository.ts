import type { AnyAbility } from "@casl/ability";
import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { eq, gt } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm/sql/sql";
import { z } from "zod";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { DrizzleAbility } from "@src/lib/drizzle-ability/drizzle-ability";
import * as schema from "../../model-schemas";

export type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];

const baseConditionSchema = z.object({
  operator: z.union([z.literal("eq"), z.literal("lt"), z.literal("gt"), z.literal("lte"), z.literal("gte")]),
  field: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()])
});

export const conditionSchema = z.union([
  z.object({
    operator: z.literal("and"),
    value: z.array(baseConditionSchema).min(2)
  }),
  z.object({
    operator: z.literal("or"),
    value: z.array(baseConditionSchema).min(2)
  }),
  baseConditionSchema
]);

export type Conditions = z.infer<typeof conditionSchema>;

type InternalAlertInput = typeof schema.RawAlert.$inferInsert;
export type AlertInput = Omit<InternalAlertInput, "conditions"> & {
  conditions: Conditions;
};
type InternalAlertOutput = typeof schema.RawAlert.$inferSelect;
export type AlertOutput = Omit<InternalAlertOutput, "conditions"> & {
  conditions: Conditions;
};

@Injectable()
export class RawAlertRepository {
  protected ability?: DrizzleAbility<typeof schema.RawAlert>;

  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  accessibleBy(...abilityParams: AbilityParams) {
    return new RawAlertRepository(this.db).withAbility(...abilityParams) as this;
  }

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(schema.RawAlert, ability, action, "RawAlert");
    return this;
  }

  protected whereAccessibleBy(where: SQL) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  async create(input: AlertInput): Promise<AlertOutput> {
    this.ability?.throwUnlessCanExecute(input);
    const [result] = await this.db.insert(schema.RawAlert).values(this.toInput(input)).returning();

    return this.toOutput(result);
  }

  async updateById(id: string, input: Partial<AlertInput>): Promise<AlertOutput | undefined> {
    const [alert] = await this.db
      .update(schema.RawAlert)
      .set(this.toInput(input))
      .where(this.whereAccessibleBy(eq(schema.RawAlert.id, id)))
      .returning();

    return alert && this.toOutput(alert);
  }

  async findOneById(id: string): Promise<AlertOutput | undefined> {
    const alert = await this.db.query.RawAlert.findFirst({
      where: this.whereAccessibleBy(eq(schema.RawAlert.id, id))
    });

    return alert && this.toOutput(alert);
  }

  async deleteOneById(id: string): Promise<AlertOutput | undefined> {
    const [alert] = await this.db
      .delete(schema.RawAlert)
      .where(this.whereAccessibleBy(eq(schema.RawAlert.id, id)))
      .returning();

    return alert && this.toOutput(alert);
  }

  async paginate({ limit, callback }: { limit: number; callback: (alert: AlertOutput[]) => Promise<void> | void }): Promise<void> {
    let lastId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const query = this.db.select().from(schema.RawAlert).orderBy(schema.RawAlert.id).limit(limit);

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

  private toInput<T extends Partial<InternalAlertInput>>(alert: T): T {
    if (alert.conditions) {
      return {
        ...alert,
        conditions: conditionSchema.parse(alert.conditions)
      };
    }

    return alert;
  }

  private toOutput(alert: InternalAlertOutput): AlertOutput {
    return {
      ...alert,
      conditions: conditionSchema.parse(alert.conditions)
    };
  }
}
