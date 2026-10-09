import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm/sql/sql";
import createError from "http-errors";

import type { ApiPgDatabase, TxService } from "@src/core";
import {
  type AbilityParams,
  type BaseRecordInput,
  type BaseRecordOutput,
  BaseRepository,
  type MutationOptions,
  type TableNameInSchema
} from "@src/core/repositories/base.repository";
import type { UnscopedReason } from "@src/core/repositories/unscoped-reasons";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const ORGANIZATION_FORBIDDEN_ERROR_CODE = "organization_forbidden";

type OrganizationScopedTable = PgTableWithColumns<any> & { organizationId: PgColumn };

type OrganizationAttributed = { organizationId?: string | null };

/** Narrows queries to the active organization in organization mode and holds writes to it in any mode; `unscoped` is the only way out. */
export abstract class OrgScopedRepository<
  T extends OrganizationScopedTable,
  Input extends BaseRecordInput<string | number>,
  Output extends BaseRecordOutput<string | number>
> extends BaseRepository<T, Input, Output> {
  #unscopedReason?: UnscopedReason;

  protected constructor(
    pg: ApiPgDatabase,
    table: T,
    txManager: TxService,
    protected readonly executionContextService: ExecutionContextService,
    entityName: string,
    tableName: TableNameInSchema<T>
  ) {
    super(pg, table, txManager, entityName, tableName);
  }

  protected abstract newInstance(): this;

  accessibleBy(...abilityParams: AbilityParams): this {
    return this.#copy().withAbility(...abilityParams);
  }

  unscoped(reason: UnscopedReason): this {
    const repository = this.#copy();
    repository.#unscopedReason = reason;

    return repository;
  }

  async create(input: Input): Promise<Output> {
    return await super.create(this.attributeToOrganization(input));
  }

  /** The organization a scoped query is narrowed to, absent outside organization mode and on an unscoped repository. */
  protected get scopedOrganizationId(): string | undefined {
    const context = this.#organizationContext;

    return context?.mode === "organization" ? context.organizationId : undefined;
  }

  protected whereInOrganization(where: SQL | undefined): SQL | undefined {
    const organizationId = this.scopedOrganizationId;

    return organizationId ? and(where, eq(this.table.organizationId, organizationId)) : where;
  }

  protected whereAccessibleBy(where: SQL | undefined): SQL | undefined {
    return super.whereAccessibleBy(this.whereInOrganization(where));
  }

  protected attributeToOrganization<V extends object>(values: V): V {
    const context = this.#organizationContext;

    if (!context) return values;

    const organizationId = (values as OrganizationAttributed).organizationId ?? context.organizationId;
    this.#assertActiveOrganization(organizationId, context);

    return { ...values, organizationId };
  }

  /** An upsert whose conflict branch was filtered out came back empty because the row it hit lies outside the active organization or the caller's rules. */
  protected requireWrittenRow<R>(row: R | undefined): R {
    if (!row) {
      throw this.#forbiddenOrganization();
    }

    return row;
  }

  protected async updateWhere(where: SQL | undefined, payload: Partial<Input>, options?: MutationOptions) {
    if (this.#organizationContext && (payload as OrganizationAttributed).organizationId !== undefined) {
      throw this.#forbiddenOrganization();
    }

    return await super.updateWhere(where, payload, options);
  }

  get #organizationContext(): OrganizationContext | undefined {
    if (this.#unscopedReason || !this.executionContextService.hasContext()) return undefined;

    return this.executionContextService.get("ORGANIZATION_CONTEXT");
  }

  #assertActiveOrganization(organizationId: string, context: OrganizationContext) {
    if (organizationId !== context.organizationId) {
      throw this.#forbiddenOrganization();
    }
  }

  #forbiddenOrganization() {
    return createError(403, "Writes are limited to the active organization", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
  }

  #copy(): this {
    const repository = this.newInstance();
    repository.#unscopedReason = this.#unscopedReason;

    return this.abilityParams ? repository.withAbility(...this.abilityParams) : repository;
  }
}
