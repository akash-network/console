import { AnyAbility } from "@casl/ability";
import { and, eq } from "drizzle-orm";
import { PgTableWithColumns } from "drizzle-orm/pg-core/table";
import { SQL } from "drizzle-orm/sql/sql";
import first from "lodash/first";

import { ApiPgDatabase, ApiPgTables, TxService } from "@src/core";
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

  get queryCursor() {
    return this.cursor.query[this.tableName] as unknown as T;
  }

  protected constructor(
    protected readonly pg: ApiPgDatabase,
    protected readonly table: T,
    protected readonly txManager: TxService,
    protected readonly entityName: string,
    protected readonly tableName: keyof ApiPgTables
  ) {}

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(this.table, ability, action, this.entityName);
    return this;
  }

  protected whereAccessibleBy(where: SQL) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  abstract accessibleBy(...abilityParams: AbilityParams): this;

  async create(input: Input) {
    this.ability?.throwUnlessCanExecute(input);

    return this.toOutput(first(await this.cursor.insert(this.table).values(input).returning()));
  }

  async findById(id: Output["id"]) {
    return this.toOutput(await this.queryCursor.findFirst({ where: this.whereAccessibleBy(eq(this.table.id, id)) }));
  }

  async findOneBy(query?: Partial<Output>) {
    return this.toOutput(
      await this.queryCursor.findFirst({
        where: this.queryToWhere(query)
      })
    );
  }

  async findOneByAndLock(query?: Partial<Output>) {
    const items: T["$inferSelect"][] = await this.txManager.getPgTx()?.select().from(this.table).where(this.queryToWhere(query)).limit(1).for("update");
    return this.toOutput(first(items));
  }

  async find(query?: Partial<Output>) {
    return this.toOutputList(
      await this.queryCursor.findMany({
        where: this.queryToWhere(query)
      })
    );
  }

  async updateById(id: Output["id"], payload: Partial<Input>, options?: MutationOptions): Promise<Output>;
  async updateById(id: Output["id"], payload: Partial<Input>): Promise<void>;
  async updateById(id: Output["id"], payload: Partial<Input>, options?: MutationOptions): Promise<void | Output> {
    return this.updateBy({ id } as Partial<Output>, payload, options);
  }

  async updateBy(query: Partial<Output>, payload: Partial<Input>, options?: MutationOptions): Promise<Output>;
  async updateBy(query: Partial<Output>, payload: Partial<Input>): Promise<void>;
  async updateBy(query: Partial<Output>, payload: Partial<Input>, options?: MutationOptions): Promise<void | Output> {
    const cursor = this.cursor.update(this.table).set(this.toInput(payload)).where(this.queryToWhere(query));

    if (options?.returning) {
      const items = await cursor.returning();
      return this.toOutput(first(items));
    }

    await cursor;

    return undefined;
  }

  async deleteBy(query: Partial<Output>, options?: MutationOptions): Promise<Output>;
  async deleteBy(query: Partial<Output>): Promise<void>;
  async deleteBy(query: Partial<Output>, options?: MutationOptions): Promise<void | Output> {
    const cursor = this.cursor.delete(this.table).where(this.queryToWhere(query));

    if (options?.returning) {
      const items = await cursor.returning();
      return this.toOutput(first(items));
    }

    await cursor;

    return undefined;
  }

  protected queryToWhere(query: Partial<T["$inferSelect"]>) {
    const fields = query && (Object.keys(query) as Array<keyof T["$inferSelect"]>);
    const where = fields?.length ? and(...fields.map(field => eq(this.table[field], query[field]))) : undefined;

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
