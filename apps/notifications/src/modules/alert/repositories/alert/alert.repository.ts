import { AnyAbility } from "@casl/ability";
import { permittedFieldsOf } from "@casl/ability/extra";
import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { and, count, eq, gt, lte, ne, or, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SQL } from "drizzle-orm/sql/sql";
import difference from "lodash/difference";
import { randomUUID } from "node:crypto";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { DrizzleAbility } from "@src/lib/drizzle-ability/drizzle-ability";
import type { ProviderLeaseId } from "@src/modules/alert/types/provider-lease.type";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";
import * as schema from "../../model-schemas";
import type { DeploymentBalanceJsonFields, GeneralJsonFields, WalletBalanceJsonFields } from "./alert-json-fields.schema";
import * as jsonFieldsSchemas from "./alert-json-fields.schema";

type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];

type InternalAlertInput = typeof schema.Alert.$inferInsert;
type InternalAlertOutput = typeof schema.Alert.$inferSelect;

export type GeneralAlertInput = Omit<InternalAlertInput, "conditions" | "params" | "type"> & GeneralJsonFields;
export type GeneralAlertOutput = Omit<InternalAlertOutput, "conditions" | "params" | "type"> & GeneralJsonFields;

export type DeploymentBalanceAlertInput = Omit<InternalAlertInput, "conditions" | "params" | "type"> & DeploymentBalanceJsonFields;
export type DeploymentBalanceAlertOutput = Omit<InternalAlertOutput, "conditions" | "params" | "type"> & DeploymentBalanceJsonFields;

export type WalletBalanceAlertInput = Omit<InternalAlertInput, "conditions" | "params" | "type"> & WalletBalanceJsonFields;
export type WalletBalanceAlertOutput = Omit<InternalAlertOutput, "conditions" | "params" | "type"> & WalletBalanceJsonFields;

export type AlertInput = GeneralAlertInput | DeploymentBalanceAlertInput | WalletBalanceAlertInput;
export type AlertOutput = GeneralAlertOutput | DeploymentBalanceAlertOutput | WalletBalanceAlertOutput;

export type AlertType = AlertOutput["type"];

export type AlertInputTypeMap = {
  DEPLOYMENT_BALANCE: DeploymentBalanceAlertInput;
  WALLET_BALANCE: WalletBalanceAlertInput;
  CHAIN_MESSAGE: GeneralAlertInput;
  CHAIN_EVENT: GeneralAlertInput;
};

export type AlertOutputTypeMap = {
  DEPLOYMENT_BALANCE: DeploymentBalanceAlertOutput;
  WALLET_BALANCE: WalletBalanceAlertOutput;
  CHAIN_MESSAGE: GeneralAlertOutput;
  CHAIN_EVENT: GeneralAlertOutput;
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

export type AlertOutputWithNotificationName = AlertOutput & {
  notificationChannelName?: string;
};

export interface UpdateInput extends Omit<Partial<AlertInput>, "params"> {
  params?: Partial<AlertInput["params"]>;
}

export interface FindAllDeploymentAlertsConditions {
  dseq: string;
  includeSuppressed?: boolean;
}

export interface ProviderMaintenanceNotificationClaim {
  alert: AlertOutput;
  claimId: string;
}

/**
 * The per-deployment escrow-balance alert is retired: the block worker no longer evaluates it.
 * Rows created before the retirement still exist, so they must stay out of anything a user can
 * still act on — otherwise they pad the alerts list and hold their notification channel hostage
 * while being invisible in the UI.
 */
const RETIRED_ALERT_TYPE: AlertType = "DEPLOYMENT_BALANCE";
const PROVIDER_MAINTENANCE_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class AlertRepository {
  protected ability?: DrizzleAbility<typeof schema.Alert>;

  protected abilityParams?: [...AbilityParams, string];

  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    protected readonly db: NodePgDatabase<typeof schema>
  ) {}

  accessibleBy(ability: AbilityParams[0], action: AbilityParams[1], subject: string = "Alert"): this {
    return new AlertRepository(this.db).withAbility(ability, action, subject) as this;
  }

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0], subject: string): this {
    this.abilityParams = [ability, action, subject];
    this.ability = new DrizzleAbility(schema.Alert, ...this.abilityParams);
    return this;
  }

  protected whereAccessibleBy(where?: SQL): SQL | undefined {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  async create<T extends AlertType>(input: AlertInputTypeMap[T]): Promise<AlertOutputTypeMap[T]> {
    this.ability?.throwUnlessCanExecute(input);
    return this.db.transaction(async transaction => {
      const [result] = await transaction.insert(schema.Alert).values(input).returning();

      return this.toOutput<T>(result as InternalAlertOutput & { type: T });
    });
  }

  async updateById(id: string, input: UpdateInput): Promise<AlertOutput | undefined> {
    if (this.abilityParams) {
      const permittedFields = permittedFieldsOf(...this.abilityParams, {
        fieldsFrom: rule => rule.fields || Object.keys(schema.Alert)
      });
      const inputKeys = Object.keys(input);
      const diff = difference(inputKeys, permittedFields);

      if (diff.length > 0) {
        throw new ForbiddenException(`Cannot update fields: ${diff.join(", ")}`);
      }
    }

    return this.db.transaction(async transaction => {
      const [alert] = await transaction
        .update(schema.Alert)
        .set({
          ...input,
          params: input.params ? sql`${schema.Alert.params} || ${sql.param(JSON.stringify(input.params))}` : undefined,
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

  async findAllDeploymentAlerts(conditions: FindAllDeploymentAlertsConditions): Promise<AlertOutput[]> {
    return this.toOutputList(
      await this.db.query.Alert.findMany({
        where: this.whereAccessibleBy(
          and(
            sql`${schema.Alert.params}->>'dseq' = ${conditions.dseq}`,
            conditions.includeSuppressed ? undefined : sql`NOT(${schema.Alert.params} @> '{"suppressedBySystem": true}')`,
            or(
              sql`${schema.Alert.params}->>'type' IS NOT NULL`,
              and(eq(schema.Alert.type, "DEPLOYMENT_BALANCE"), sql`${schema.Alert.params}->>'owner' IS NOT NULL`)
            )
          )
        )
      })
    );
  }

  /**
   * Finds the deployment-closed CHAIN_EVENT alert for a specific owner AND dseq.
   *
   * dseq is per-owner (not globally unique) and the owner is stored in the alert's
   * `conditions.value[]` (not `params`), so both must be matched. This runs in a
   * background/system context with no CASL ability scope, so it is intentionally
   * not filtered by `whereAccessibleBy`.
   */
  async findDeploymentClosedAlertByOwnerAndDseq(owner: string, dseq: string): Promise<AlertOutput | undefined> {
    const alert = await this.db.query.Alert.findFirst({
      where: and(
        eq(schema.Alert.type, "CHAIN_EVENT"),
        // Containment (`@>`) rather than `->>` extraction so the GIN `jsonb_path_ops`
        // index on `params` (idx_alerts_params) is used; dseq is stored as a string.
        sql`${schema.Alert.params} @> ${JSON.stringify({ type: "DEPLOYMENT_CLOSED", dseq })}::jsonb`,
        sql`${schema.Alert.conditions}->'value' @> ${JSON.stringify([{ field: "owner", value: owner }])}::jsonb`
      )
    });

    return alert && this.toOutput(alert);
  }

  /**
   * Atomically claims the reclaim notification for an alert by stamping
   * `params.reclaimNotifiedAt`, but only if it has not been claimed before.
   * Returns the updated alert when this call won the claim, or `undefined` when
   * it was already claimed (replay / pg-boss redelivery) — making the reclaim
   * email exactly-once.
   */
  async claimReclaimNotification(id: string): Promise<AlertOutput | undefined> {
    return this.db.transaction(async transaction => {
      const [alert] = await transaction
        .update(schema.Alert)
        .set({
          params: sql`COALESCE(${schema.Alert.params}, '{}'::jsonb) || jsonb_build_object('reclaimNotifiedAt', to_jsonb(NOW()))`,
          updatedAt: sql`NOW()`
        })
        .where(and(eq(schema.Alert.id, id), sql`NOT jsonb_exists(COALESCE(${schema.Alert.params}, '{}'::jsonb), 'reclaimNotifiedAt')`))
        .returning();

      return alert && this.toOutput(alert);
    });
  }

  async claimProviderMaintenanceNotification(
    id: string,
    provider: string,
    maintenanceId: string,
    lease: ProviderLeaseId
  ): Promise<ProviderMaintenanceNotificationClaim | undefined> {
    const notificationKey = this.toProviderMaintenanceNotificationKey(provider, maintenanceId, lease);
    const claimId = randomUUID();

    return this.db.transaction(async transaction => {
      const [alert] = await transaction
        .update(schema.Alert)
        .set({
          params: sql`jsonb_set(
            COALESCE(${schema.Alert.params}, '{}'::jsonb),
            '{providerMaintenanceNotifications}',
            COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)
              || jsonb_build_object(
                ${notificationKey}::text,
                jsonb_build_object('status', 'pending', 'claimId', ${claimId}::text, 'claimedAt', NOW())
              )
          )`,
          updatedAt: sql`NOW()`
        })
        .where(
          and(
            eq(schema.Alert.id, id),
            sql`NOT (COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb) ? ${notificationKey}::text)
              OR (
                COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)->${notificationKey}::text->>'status' = 'pending'
                AND (
                  COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)->${notificationKey}::text->>'claimedAt'
                )::timestamptz <= NOW() - (${PROVIDER_MAINTENANCE_CLAIM_TIMEOUT_MS} * INTERVAL '1 millisecond')
              )`
          )
        )
        .returning();

      return alert && { alert: this.toOutput(alert), claimId };
    });
  }

  async completeProviderMaintenanceNotification(id: string, provider: string, maintenanceId: string, lease: ProviderLeaseId, claimId: string): Promise<void> {
    const notificationKey = this.toProviderMaintenanceNotificationKey(provider, maintenanceId, lease);

    await this.db
      .update(schema.Alert)
      .set({
        params: sql`jsonb_set(
          COALESCE(${schema.Alert.params}, '{}'::jsonb),
          '{providerMaintenanceNotifications}',
          COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)
            || jsonb_build_object(${notificationKey}::text, jsonb_build_object('status', 'sent', 'sentAt', NOW()))
        )`,
        updatedAt: sql`NOW()`
      })
      .where(
        and(
          eq(schema.Alert.id, id),
          sql`COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)->${notificationKey}::text->>'status' = 'pending'`,
          sql`COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)->${notificationKey}::text->>'claimId' = ${claimId}::text`
        )
      );
  }

  async releaseProviderMaintenanceNotification(id: string, provider: string, maintenanceId: string, lease: ProviderLeaseId, claimId: string): Promise<void> {
    const notificationKey = this.toProviderMaintenanceNotificationKey(provider, maintenanceId, lease);

    await this.db
      .update(schema.Alert)
      .set({
        params: sql`jsonb_set(
          COALESCE(${schema.Alert.params}, '{}'::jsonb),
          '{providerMaintenanceNotifications}',
          COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb) - ${notificationKey}::text
        )`,
        updatedAt: sql`NOW()`
      })
      .where(
        and(
          eq(schema.Alert.id, id),
          sql`COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)->${notificationKey}::text->>'status' = 'pending'`,
          sql`COALESCE(${schema.Alert.params}->'providerMaintenanceNotifications', '{}'::jsonb)->${notificationKey}::text->>'claimId' = ${claimId}::text`
        )
      );
  }

  private toProviderMaintenanceNotificationKey(provider: string, maintenanceId: string, lease: ProviderLeaseId): string {
    return [provider, maintenanceId, lease.owner, lease.dseq, lease.gseq, lease.oseq, lease.bseq, lease.provider].join("/");
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

  async deleteAllByUserId(userId: string, tx: NodePgDatabase<typeof schema> = this.db): Promise<number> {
    const deleted = await tx.delete(schema.Alert).where(eq(schema.Alert.userId, userId)).returning({ id: schema.Alert.id });

    return deleted.length;
  }

  async countActiveByNotificationChannelId(notificationChannelId: string): Promise<number> {
    const result = await this.db
      .select({ count: count(schema.Alert.id) })
      .from(schema.Alert)
      .where(
        this.whereAccessibleBy(
          and(
            eq(schema.Alert.notificationChannelId, notificationChannelId),
            ne(schema.Alert.type, RETIRED_ALERT_TYPE),
            sql`NOT(${schema.Alert.params} @> '{"suppressedBySystem": true}')`
          )
        )
      );
    return Number(result[0].count);
  }

  async paginate(options: ListLookupOptions): Promise<PaginatedResult<AlertOutputWithNotificationName>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;
    let where = and(this.whereAccessibleBy(), ne(schema.Alert.type, RETIRED_ALERT_TYPE), sql`NOT(${schema.Alert.params} @> '{"suppressedBySystem": true}')`);

    if (options.query?.dseq) {
      where = and(where, sql`${schema.Alert.params}->>'dseq' = ${options.query.dseq}`);
    }

    if (options.query?.type) {
      where = and(where, sql`${schema.Alert.params}->>'type' = ${options.query.type}`);
    }

    const alerts = await this.db
      .select({
        alert: schema.Alert,
        notificationName: NotificationChannel.name
      })
      .from(schema.Alert)
      .innerJoin(NotificationChannel, eq(schema.Alert.notificationChannelId, NotificationChannel.id))
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(schema.Alert.createdAt);

    const countResult = await this.db
      .select({ count: count(schema.Alert.id) })
      .from(schema.Alert)
      .where(where);

    const total = Number(countResult[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: alerts.map(({ alert, notificationName }) => ({
        ...this.toOutput(alert),
        notificationChannelName: notificationName || "NA"
      })),
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
    const clauses = [eq(schema.Alert.enabled, true), eq(schema.Alert.type, query.type)];

    if (query.block) {
      clauses.push(lte(schema.Alert.minBlockHeight, query.block));
    }

    if (query.status) {
      clauses.push(eq(schema.Alert.status, query.status));
    }

    while (hasMore) {
      const where = lastId ? and(...clauses, gt(schema.Alert.id, lastId)) : and(...clauses);
      const cursor = this.db.select().from(schema.Alert).where(where).orderBy(schema.Alert.id).limit(limit);

      const batch = await cursor;

      if (batch.length === 0) {
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

    if (["CHAIN_MESSAGE", "CHAIN_EVENT"].includes(type)) {
      return {
        ...rest,
        ...jsonFieldsSchemas.generalJsonFieldsSchema.parse({ type, conditions, params: params ?? undefined })
      } as AlertOutputTypeMap[T];
    }

    if (type === "DEPLOYMENT_BALANCE") {
      return {
        ...rest,
        ...jsonFieldsSchemas.deploymentBalanceJsonFieldsSchema.parse({ type, conditions, params })
      } as AlertOutputTypeMap[T];
    }

    if (type === "WALLET_BALANCE") {
      return {
        ...rest,
        ...jsonFieldsSchemas.walletBalanceJsonFieldsSchema.parse({ type, conditions, params })
      } as AlertOutputTypeMap[T];
    }

    throw new Error("Unknown Alert type");
  }
}
