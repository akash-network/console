import { DrizzleAbility } from "@akashnetwork/drizzle-ability";
import { type AnyAbility, subject } from "@casl/ability";
import type { DBQueryConfig } from "drizzle-orm";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgTable, PgTableWithColumns } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm/sql/sql";
import { PostgresError } from "postgres";

import { ShadowedAbility } from "@src/auth/services/ability/shadowed-ability";
import type { ApiPgDatabase, ApiPgTables, ApiTransaction, TxService } from "@src/core";

export type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];

export interface MutationOptions {
  returning: true;
}

export interface BaseRecordInput<T> {
  id?: T;
}

export interface BaseRecordOutput<T> {
  id: T;
}

export abstract class BaseRepository<
  T extends PgTableWithColumns<any>,
  Input extends BaseRecordInput<string | number>,
  Output extends BaseRecordOutput<string | number>
> {
  protected ability?: DrizzleAbility<T>;
  #abilityParams?: AbilityParams;

  get cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  get queryCursor(): T {
    return this.cursor.query[this.tableName];
  }

  protected constructor(
    protected readonly pg: ApiPgDatabase,
    protected readonly table: T,
    protected readonly txManager: TxService,
    protected readonly entityName: string,
    protected readonly tableName: TableNameInSchema<T>
  ) {}

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(this.table, ability, action, this.entityName);
    this.#abilityParams = [ability, action];
    return this;
  }

  protected get abilityParams(): AbilityParams | undefined {
    return this.#abilityParams;
  }

  protected whereAccessibleBy(where: SQL | undefined) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  abstract accessibleBy(...abilityParams: AbilityParams): this;

  protected async ensureTransaction<T>(cb: (tx: ApiTransaction) => Promise<T>) {
    const txCursor = this.txManager.getPgTx();

    if (txCursor) {
      return await cb(txCursor);
    }

    return await this.pg.transaction(async tx => await cb(tx));
  }

  async create(input: Input): Promise<Output> {
    this.ability?.throwUnlessCanExecute(input);
    const [item] = await this.cursor.insert(this.table).values(input).returning();

    return this.toOutput(item);
  }

  async findById(id: Output["id"]): Promise<Output | undefined> {
    const item = await this.queryCursor.findFirst({
      where: this.whereAccessibleBy(eq(this.table.id, id))
    });
    if (!item) return undefined;
    this.#compareWithShadowAbility([item]);
    return this.toOutput(item);
  }

  async findOneBy(query?: Partial<Output>): Promise<Output | undefined> {
    const item = await this.queryCursor.findFirst({
      where: this.queryToWhere(query)
    });
    if (!item) return undefined;
    this.#compareWithShadowAbility([item]);
    return this.toOutput(item);
  }

  async findOneByAndLock(query?: Partial<Output>): Promise<Output | undefined> {
    const items: T["$inferSelect"][] | undefined = await this.txManager
      .getPgTx()
      ?.select()
      .from(this.table as PgTable)
      .where(this.queryToWhere(query))
      .limit(1)
      .for("update");
    if (!items || items.length === 0) return undefined;
    this.#compareWithShadowAbility(items);
    return this.toOutput(items[0]);
  }

  async find(query?: Partial<Output>, options?: { select?: Array<keyof Output>; limit?: number; offset?: number }) {
    const params: DBQueryConfig<"many", true> = {
      where: this.queryToWhere(query)
    };

    if (options?.select) {
      params.columns = options.select.reduce((acc, field) => ({ ...acc, [field]: true }), {});
    }

    if (options?.limit) {
      params.limit = options.limit;
    }

    if (options?.offset) {
      params.offset = options.offset;
    }

    const items = await this.queryCursor.findMany(params);

    if (!params.columns) {
      this.#compareWithShadowAbility(items);
    }

    return this.toOutputList(items);
  }

  async paginate({ query, ...options }: { select?: Array<keyof Output>; limit?: number; query?: Partial<Output> }, cb: (page: Output[]) => Promise<void>) {
    return this.paginateRaw({ ...options, where: this.queryToWhere(query) }, cb);
  }

  protected async paginateRaw(params: Omit<DBQueryConfig<"many", true>, "offset">, cb: (page: Output[]) => Promise<void>) {
    let offset = 0;
    let hasNextPage = true;
    params.limit = params.limit || 100;

    while (hasNextPage) {
      const rows = await this.queryCursor.findMany({ ...params, offset });
      this.#compareWithShadowAbility(rows);
      const items = this.toOutputList(rows);
      offset += items.length;
      hasNextPage = items.length === params.limit;

      if (items.length) {
        await cb(items);
      }
    }
  }

  async updateById(id: Output["id"], payload: Partial<Input>, options?: MutationOptions): Promise<Output>;
  async updateById(id: Output["id"], payload: Partial<Input>): Promise<void>;
  async updateById(id: Output["id"], payload: Partial<Input>, options?: MutationOptions): Promise<void | Output> {
    return this.updateBy({ id } as Partial<Output>, payload, options);
  }

  async updateManyById(ids: Output["id"][], payload: Partial<Input>): Promise<void> {
    await this.updateWhere(this.whereAccessibleBy(inArray(this.table.id, ids)), payload);
  }

  async updateBy(query: Partial<Output>, payload: Partial<Input>, options?: MutationOptions): Promise<undefined | Output>;
  async updateBy(query: Partial<Output>, payload: Partial<Input>): Promise<void>;
  async updateBy(query: Partial<Output>, payload: Partial<Input>, options?: MutationOptions): Promise<void | Output> {
    const [item] = await this.updateWhere(this.queryToWhere(query), payload, options);

    if (!options?.returning || !item) return undefined;

    return this.toOutput(item);
  }

  /** The where clause only vets rows as they were, so with an ability attached every row is checked again as written, in the same transaction. */
  protected async updateWhere(where: SQL | undefined, payload: Partial<Input>, options?: MutationOptions): Promise<T["$inferSelect"][]> {
    const set = this.toUpdateSet(payload);

    if (!this.ability) {
      const statement = this.cursor.update(this.table).set(set).where(where);

      if (options?.returning) return await statement.returning();

      await statement;

      return [];
    }

    return await this.writeChecked(cursor => cursor.update(this.table).set(set).where(where).returning());
  }

  /** With an ability attached, runs a write that returns whole rows in a transaction and rejects it when any written row falls outside the rules. */
  protected async writeChecked(write: (cursor: ApiPgDatabase | ApiTransaction) => Promise<T["$inferSelect"][]>): Promise<T["$inferSelect"][]> {
    const ability = this.ability;

    if (!ability) return await write(this.cursor);

    return await this.ensureTransaction(async tx => {
      const rows = await write(tx);
      rows.forEach(row => ability.throwUnlessCanExecute(row));

      return rows;
    });
  }

  async deleteById(id: Output["id"] | Output["id"][]): Promise<void> {
    const where = Array.isArray(id) ? inArray(this.table.id, id) : eq(this.table.id, id);
    await this.cursor.delete(this.table).where(this.whereAccessibleBy(where));
  }

  async count(query?: Partial<Output>): Promise<number> {
    const [result] = await this.cursor
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table as PgTable)
      .where(this.queryToWhere(query));
    return result?.count ?? 0;
  }

  async deleteBy(query: Partial<Output>, options?: MutationOptions): Promise<Output>;
  async deleteBy(query: Partial<Output>): Promise<void>;
  async deleteBy(query: Partial<Output>, options?: MutationOptions): Promise<void | Output> {
    const cursor = this.cursor.delete(this.table).where(this.queryToWhere(query));

    if (options?.returning) {
      const [item] = await cursor.returning();
      if (!item) return undefined;
      this.#compareWithShadowAbility([item]);
      return this.toOutput(item);
    }

    await cursor;

    return undefined;
  }

  protected queryToWhere(query: Partial<T["$inferSelect"]> | undefined) {
    if (!query) return this.whereAccessibleBy(undefined);

    const fields = Object.keys(query).filter(key => query[key as keyof typeof query] !== undefined) as Array<keyof T["$inferSelect"]>;
    const where = fields.length
      ? and(...fields.map(field => (query[field] === null ? isNull(this.table[field]) : eq(this.table[field], query[field]))))
      : undefined;

    return this.whereAccessibleBy(where);
  }

  /** Legacy filters pick the rows, so asking the shadowed ability about each one is what reports the rows organization rules would hide. */
  #compareWithShadowAbility(rows: Array<T["$inferSelect"]>) {
    const [ability, action] = this.#abilityParams ?? [];

    if (!(ability instanceof ShadowedAbility)) return;

    for (const row of rows) {
      ability.can(action, subject(this.entityName, { ...row }));
    }
  }

  /** Drizzle builds the SET clause from schema property names, so a raw column key such as updated_at is dropped without an error. */
  private toUpdateSet(payload: Partial<Input>) {
    return { updatedAt: sql`now()`, ...this.toInput(payload) };
  }

  protected toInput(payload: Partial<Input>): Partial<T["$inferInsert"]> {
    return payload as Partial<T["$inferSelect"]>;
  }

  protected toOutputList(dbOutput: T["$inferSelect"][]): Output[] {
    return dbOutput.map(item => this.toOutput(item));
  }

  protected toOutput(payload: Partial<T["$inferSelect"]>): Output {
    return payload as Output;
  }
}

type TablesOnly<T> = {
  [K in keyof T as T[K] extends PgTableWithColumns<any> ? K : never]: T[K];
};

type TableName<T extends PgTableWithColumns<any>> = T extends PgTableWithColumns<infer TableConfig> ? TableConfig["name"] : never;
export type TableNameInSchema<T extends PgTableWithColumns<any>> = {
  [K in keyof TablesOnly<ApiPgTables> as TableName<ApiPgTables[K]>]: K;
}[TableName<T>];

const UNIQUE_VIOLATION_CODE = "23505";
// drizzle-orm >=0.44 wraps driver errors in DrizzleQueryError; the underlying PostgresError lives on .cause
export function getPostgresError(error: unknown): PostgresError | undefined {
  if (error instanceof PostgresError) return error;
  if (error instanceof Error && error.cause instanceof PostgresError) return error.cause;
  return undefined;
}

export function isUniqueViolation(error: unknown): error is PostgresError {
  return getPostgresError(error)?.code === UNIQUE_VIOLATION_CODE;
}
