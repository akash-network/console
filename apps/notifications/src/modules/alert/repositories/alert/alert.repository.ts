import type { AnyAbility } from "@casl/ability";
import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gt, lte, or, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm/sql/sql";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { DrizzleAbility } from "@src/lib/drizzle-ability/drizzle-ability";
import * as schema from "../../model-schemas";
import { Alert } from "../../model-schemas";
import type { ChainMessageJsonFields, DeploymentBalanceJsonFields } from "./alert-json-fields.schema";
import * as jsonFieldsSchemas from "./alert-json-fields.schema";

export type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];

type InternalAlertInput = typeof schema.Alert.$inferInsert;
type InternalAlertOutput = typeof schema.Alert.$inferSelect;

export type ChainMessageAlertInput = Omit<InternalAlertInput, "conditions" | "params" | "type"> & ChainMessageJsonFields;
export type ChainMessageAlertOutput = Omit<InternalAlertOutput, "conditions" | "params" | "type"> & ChainMessageJsonFields;

export type DeploymentBalanceAlertInput = Omit<InternalAlertInput, "conditions" | "params" | "type"> & DeploymentBalanceJsonFields;
export type DeploymentBalanceAlertOutput = Omit<InternalAlertOutput, "conditions" | "params" | "type"> & DeploymentBalanceJsonFields;

export type AlertInput = ChainMessageAlertInput | DeploymentBalanceAlertInput;
export type AlertOutput = ChainMessageAlertOutput | DeploymentBalanceAlertOutput;

export type AlertType = AlertOutput["type"];

export type AlertInputTypeMap = {
  DEPLOYMENT_BALANCE: DeploymentBalanceAlertInput;
  CHAIN_MESSAGE: ChainMessageAlertInput;
};

export type AlertOutputTypeMap = {
  DEPLOYMENT_BALANCE: DeploymentBalanceAlertOutput;
  CHAIN_MESSAGE: ChainMessageAlertOutput;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ListLookupOptions = {
  query?: {
    dseq?: string;
    type?: string;
  };
  limit?: number;
  page?: number;
};

@Injectable()
export class AlertRepository {
  protected ability?: DrizzleAbility<typeof schema.Alert>;

  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>
  ) {}

  accessibleBy(...abilityParams: AbilityParams) {
    return new AlertRepository(this.db).withAbility(...abilityParams) as this;
  }

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(schema.Alert, ability, action, "Alert");
    return this;
  }

  protected whereAccessibleBy(where?: SQL) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  async create<T extends AlertType>(input: AlertInputTypeMap[T]): Promise<AlertOutputTypeMap[T]> {
    this.ability?.throwUnlessCanExecute(input);
    return this.db.transaction(async transaction => {
      const [result] = await transaction.insert(schema.Alert).values(input).returning();

      return this.toOutput<T>(result as InternalAlertOutput & { type: T });
    });
  }

  async updateById(id: string, input: Partial<AlertInput>): Promise<AlertOutput | undefined> {
    return this.db.transaction(async transaction => {
      const [alert] = await transaction
        .update(schema.Alert)
        .set({
          ...input,
          updatedAt: sql`NOW()`
        })
        .where(this.whereAccessibleBy(eq(schema.Alert.id, id)))
        .returning();

      return alert && this.toOutput(alert);
    });
  }

  async findOneById(id: string): Promise<AlertOutput | undefined> {
    const alert = await this.db.query.Alert.findFirst({
      where: this.whereAccessibleBy(eq(schema.Alert.id, id))
    });

    return alert && this.toOutput(alert);
  }

  async findAllDeploymentAlerts(dseq: string): Promise<AlertOutput[]> {
    return this.toOutputList(
      await this.db.query.Alert.findMany({
        where: this.whereAccessibleBy(
          and(
            sql`${schema.Alert.params}->>'dseq' = ${dseq}`,
            or(
              sql`${schema.Alert.params}->>'type' IS NOT NULL`,
              and(eq(schema.Alert.type, "DEPLOYMENT_BALANCE"), sql`${schema.Alert.params}->>'owner' IS NOT NULL`)
            )
          )
        )
      })
    );
  }

  async deleteOneById(id: string): Promise<AlertOutput | undefined> {
    return this.db.transaction(async transaction => {
      const [alert] = await transaction
        .delete(schema.Alert)
        .where(this.whereAccessibleBy(eq(schema.Alert.id, id)))
        .returning();

      return alert && this.toOutput(alert);
    });
  }

  async paginate(options: ListLookupOptions): Promise<PaginatedResult<AlertOutput>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    let where = this.whereAccessibleBy();

    if (options.query?.dseq) {
      where = and(where, sql`${schema.Alert.params}->>'dseq' = ${options.query.dseq}`);
    }

    if (options.query?.type) {
      where = and(where, sql`${schema.Alert.params}->>'type' = ${options.query.type}`);
    }

    const alerts = await this.db.query.Alert.findMany({
      where,
      limit,
      offset,
      orderBy: schema.Alert.createdAt
    });

    const countResult = await this.db
      .select({ count: count(schema.Alert.id) })
      .from(schema.Alert)
      .where(where);

    const total = Number(countResult[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: this.toOutputList(alerts),
      pagination: {
        total,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  async paginateAll<T extends AlertType>({
    query,
    limit,
    callback
  }: {
    query: { type: T; block?: number; status?: AlertOutput["status"] };
    limit: number;
    callback: (alerts: AlertOutputTypeMap[T][]) => Promise<void>;
  }): Promise<void> {
    let lastId: string | undefined;
    let hasMore = true;
    const clauses = [eq(Alert.enabled, true), eq(Alert.type, query.type)];

    if (query.block) {
      clauses.push(lte(Alert.minBlockHeight, query.block));
    }

    if (query.status) {
      clauses.push(eq(Alert.status, query.status));
    }

    while (hasMore) {
      const where = lastId ? and(...clauses, gt(schema.Alert.id, lastId)) : and(...clauses);
      const cursor = this.db.select().from(schema.Alert).where(where).orderBy(schema.Alert.id).limit(limit);

      const batch = await cursor;

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      await callback(this.toTypedOutputList<T>(query.type, batch));

      lastId = batch[batch.length - 1].id;

      if (batch.length < limit) {
        hasMore = false;
      }
    }
  }

  private toOutputList(alerts: InternalAlertOutput[]): AlertOutput[] {
    return alerts.map(alert => this.toOutput(alert));
  }

  private toTypedOutputList<T extends AlertType>(type: T, alerts: InternalAlertOutput[]): AlertOutputTypeMap[T][] {
    return alerts.map(alert => this.toOutput(alert as InternalAlertOutput & { type: T }));
  }

  private toOutput<T extends AlertType>(alert: InternalAlertOutput & { type: T }): AlertOutputTypeMap[T] {
    const { conditions, params, type, ...rest } = alert;

    if (type === "CHAIN_MESSAGE") {
      return {
        ...rest,
        ...jsonFieldsSchemas.chainMessageJsonFieldsSchema.parse({ type, conditions, params: params ?? undefined })
      } as AlertOutputTypeMap[T];
    }

    if (type === "DEPLOYMENT_BALANCE") {
      return {
        ...rest,
        ...jsonFieldsSchemas.deploymentBalanceJsonFieldsSchema.parse({ type, conditions, params })
      } as AlertOutputTypeMap[T];
    }

    throw new Error("Unknown Alert type");
  }
}
