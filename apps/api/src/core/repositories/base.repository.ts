import type { AnyAbility } from "@casl/ability";
import type { DBQueryConfig } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm/sql/sql";

import type { ApiPgDatabase, ApiPgTables, TxService } from "@src/core";
import { DrizzleAbility } from "@src/lib/drizzle-ability/drizzle-ability";

export type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];

interface MutationOptions {
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
    return this;
  }

  protected whereAccessibleBy(where: SQL | undefined) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  abstract accessibleBy(...abilityParams: AbilityParams): this;

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
    return this.toOutput(item);
  }

  async findOneBy(query?: Partial<Output>): Promise<Output | undefined> {
    const item = await this.queryCursor.findFirst({
      where: this.queryToWhere(query)
    });
    if (!item) return undefined;
    return this.toOutput(item);
  }

  async findOneByAndLock(query?: Partial<Output>): Promise<Output | undefined> {
    const items: T["$inferSelect"][] | undefined = await this.txManager
      .getPgTx()
      ?.select()
      .from(this.table)
      .where(this.queryToWhere(query))
      .limit(1)
      .for("update");
    if (!items || items.length === 0) return undefined;
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

    return this.toOutputList(await this.queryCursor.findMany(params));
  }

  async paginate({ query, ...options }: { select?: Array<keyof Output>; limit?: number; query?: Partial<Output> }, cb: (page: Output[]) => Promise<void>) {
    return this.paginateRaw({ ...options, where: this.queryToWhere(query) }, cb);
  }

  protected async paginateRaw(params: Omit<DBQueryConfig<"many", true>, "offset">, cb: (page: Output[]) => Promise<void>) {
    let offset = 0;
    let hasNextPage = true;
    params.limit = params.limit || 100;

    while (hasNextPage) {
      const items = this.toOutputList(await this.queryCursor.findMany({ ...params, offset }));
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
    await this.cursor
      .update(this.table)
      .set({
        ...this.toInput(payload),
        updated_at: sql`now()`
      })
      .where(inArray(this.table.id, ids));
  }

  async updateBy(query: Partial<Output>, payload: Partial<Input>, options?: MutationOptions): Promise<Output>;
  async updateBy(query: Partial<Output>, payload: Partial<Input>): Promise<void>;
  async updateBy(query: Partial<Output>, payload: Partial<Input>, options?: MutationOptions): Promise<void | Output> {
    const cursor = this.cursor
      .update(this.table)
      .set({
        ...this.toInput(payload),
        updated_at: sql`now()`
      })
      .where(this.queryToWhere(query));

    if (options?.returning) {
      const [item] = await cursor.returning();
      if (!item) return undefined;
      return this.toOutput(item);
    }

    await cursor;

    return undefined;
  }

  async deleteById(id: Output["id"] | Output["id"][]): Promise<void> {
    const where = Array.isArray(id) ? inArray(this.table.id, id) : eq(this.table.id, id);
    await this.cursor.delete(this.table).where(this.whereAccessibleBy(where));
  }

  async deleteBy(query: Partial<Output>, options?: MutationOptions): Promise<Output>;
  async deleteBy(query: Partial<Output>): Promise<void>;
  async deleteBy(query: Partial<Output>, options?: MutationOptions): Promise<void | Output> {
    const cursor = this.cursor.delete(this.table).where(this.queryToWhere(query));

    if (options?.returning) {
      const [item] = await cursor.returning();
      if (!item) return undefined;
      return this.toOutput(item);
    }

    await cursor;

    return undefined;
  }

  protected queryToWhere(query: Partial<T["$inferSelect"]> | undefined) {
    if (!query) return this.whereAccessibleBy(undefined);

    const fields = Object.keys(query) as Array<keyof T["$inferSelect"]>;
    const where = fields.length ? and(...fields.map(field => eq(this.table[field], query[field]))) : undefined;

    return this.whereAccessibleBy(where);
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
type TableNameInSchema<T extends PgTableWithColumns<any>> = {
  [K in keyof TablesOnly<ApiPgTables> as TableName<ApiPgTables[K]>]: K;
}[TableName<T>];
