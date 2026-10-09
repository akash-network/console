import type { Abilities, AnyAbility, CanParameters, RuleOf } from "@casl/ability";
import { ForbiddenError, subject } from "@casl/ability";
import type { AbilityQuery } from "@casl/ability/extra";
import { rulesToQuery } from "@casl/ability/extra";
import type { Condition } from "@ucast/core";
import { CompoundCondition, FieldCondition } from "@ucast/core";
import type { Column, SQL } from "drizzle-orm";
import { and, eq, getTableColumns, getTableName, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, not, notInArray, or } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

type FieldOperator = (column: Column, value: unknown) => SQL;
type CompoundOperator = (...clauses: SQL[]) => SQL | undefined;

const FIELD_OPERATORS: Record<string, FieldOperator | undefined> = {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  in: (column, values) => inArray(column, values as unknown[]),
  nin: (column, values) => notInArray(column, values as unknown[])
};

const COMPOUND_OPERATORS: Record<string, CompoundOperator | undefined> = { and, or };

export class DrizzleAbility<T extends PgTableWithColumns<any>, A extends AnyAbility = AnyAbility> {
  readonly #whereClause: SQL | undefined;

  constructor(
    private readonly table: T,
    private readonly ability: A,
    private readonly action: CanParameters<Abilities>[0],
    private readonly subjectType: CanParameters<Abilities>[1]
  ) {
    this.#whereClause = this.#buildWhereClause();
  }

  throwUnlessCanExecute(payload: Record<string, any>): void {
    const params = [this.action, subject(this.subjectType as string, payload)] as unknown as Parameters<A["can"]>;
    ForbiddenError.from(this.ability).throwUnlessCan(...params);
  }

  whereAccessibleBy(where?: SQL): SQL | undefined {
    return this.#whereClause ? and(where, this.#whereClause) : where;
  }

  #buildWhereClause(): SQL | undefined {
    const params = [this.action, this.subjectType] as unknown as Parameters<A["can"]>;
    ForbiddenError.from(this.ability).throwUnlessCan(...params);

    const { $and = [], $or = [] } = rulesToQuery(this.ability, params[0], params[1], rule => this.#ruleToClause(rule)) as AbilityQuery<SQL>;

    return and(...$and, or(...$or));
  }

  #ruleToClause(rule: RuleOf<A>): SQL {
    if (!rule.ast) {
      throw new Error("Unable to create query without AST");
    }

    const clause = this.#conditionToClause(rule.ast);

    return rule.inverted ? not(clause) : clause;
  }

  #conditionToClause(condition: Condition): SQL {
    if (condition instanceof CompoundCondition) {
      return this.#compoundConditionToClause(condition);
    }

    if (condition instanceof FieldCondition) {
      return this.#fieldConditionToClause(condition);
    }

    throw new Error(`Unsupported condition "${condition.operator}"`);
  }

  #compoundConditionToClause({ operator, value }: CompoundCondition): SQL {
    const combine = COMPOUND_OPERATORS[operator];

    if (!combine) {
      throw new Error(`Unsupported operator "${operator}"`);
    }

    const clause = combine(...value.map(condition => this.#conditionToClause(condition)));

    if (!clause) {
      throw new Error(`Unable to combine an empty "${operator}" condition`);
    }

    return clause;
  }

  #fieldConditionToClause({ operator, field, value }: FieldCondition): SQL {
    const column = this.#columnOf(field);

    if (value === null) {
      return operator === "ne" ? isNotNull(column) : isNull(column);
    }

    const compare = FIELD_OPERATORS[operator];

    if (!compare) {
      throw new Error(`Unsupported operator "${operator}"`);
    }

    return compare(column, value);
  }

  #columnOf(field: string): Column {
    const columns: Record<string, Column | undefined> = getTableColumns(this.table);
    const column = columns[field];

    if (!column) {
      throw new Error(`Rule field "${field}" does not exist on table "${getTableName(this.table)}"`);
    }

    return column;
  }
}
