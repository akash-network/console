import type { Abilities, AnyAbility, CanParameters } from "@casl/ability";
import { ForbiddenError, subject } from "@casl/ability";
import { rulesToQuery } from "@casl/ability/extra";
import { CompoundCondition, FieldCondition } from "@ucast/core";
import type { BinaryOperator } from "drizzle-orm";
import { and, eq, gt, gte, isNull, lt, lte, ne, or } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core/table";
import type { SQL } from "drizzle-orm/sql/sql";

export class DrizzleAbility<T extends PgTableWithColumns<any>, A extends AnyAbility = AnyAbility> {
  private readonly OPS: Record<string, BinaryOperator> = {
    eq: eq,
    ne: ne,
    gt: gt,
    gte: gte,
    lt: lt,
    lte: lte
  };

  private readonly OPS_INVERTED: Record<string, string> = {
    eq: "ne",
    ne: "eq",
    gt: "lte",
    gte: "lt",
    lt: "gte",
    lte: "gt",
    in: "nin",
    nin: "in"
  };
  private readonly abilityClause = this.toDrizzleWhereClause();

  constructor(
    private readonly table: T,
    private readonly ability: A,
    private readonly action: CanParameters<Abilities>[0],
    private readonly subjectType: CanParameters<Abilities>[1]
  ) {}

  throwUnlessCanExecute(payload: Record<string, any>) {
    const params = [this.action, subject(this.subjectType as string, payload)] as unknown as Parameters<A["can"]>;
    ForbiddenError.from(this.ability).throwUnlessCan(...params);
  }

  whereAccessibleBy(where: SQL) {
    return this.abilityClause ? and(where, this.abilityClause) : where;
  }

  private toDrizzleWhereClause() {
    const params = [this.action, this.subjectType] as unknown as Parameters<A["can"]>;
    ForbiddenError.from(this.ability).throwUnlessCan(...params);

    const { $and = [], $or = [] } = rulesToQuery(this.ability, params[0], params[1], rule => {
      if (!rule.ast) {
        throw new Error("Unable to create query without AST");
      }

      if (rule.inverted) {
        return {
          ...rule.ast,
          operator: this.OPS_INVERTED[rule.ast.operator]
        };
      }

      return rule.ast;
    }) as { $and: FieldCondition[]; $or: FieldCondition[] };

    if (!$and.length && !$or.length) {
      return;
    }

    const conditions: (FieldCondition | CompoundCondition<FieldCondition>)[] = $and;

    if ($or.length) {
      conditions.push(new CompoundCondition("or", $or));
    }

    return this.buildCondition(new CompoundCondition("and", conditions));
  }

  private buildCondition(condition: CompoundCondition<FieldCondition | CompoundCondition<FieldCondition>> | FieldCondition): SQL | undefined {
    if (!condition.operator || !("value" in condition)) {
      throw new Error("Invalid condition structure");
    }

    if (condition instanceof CompoundCondition) {
      switch (condition.operator.toLowerCase()) {
        case "and":
          return condition.value.length === 1 ? this.buildCondition(condition.value[0]) : and(...condition.value.map(value => this.buildCondition(value)));
        case "or":
          return condition.value.length === 1 ? this.buildCondition(condition.value[0]) : or(...condition.value.map(value => this.buildCondition(value)));
      }
    }

    if (condition instanceof FieldCondition) {
      if (condition.value === null) {
        return isNull(this.table[condition.field]);
      }

      const op = this.OPS[condition.operator.toLowerCase()];

      if (!op) {
        throw new Error(`Unsupported operator: ${condition.operator}`);
      }

      return op(this.table[condition.field], condition.value);
    }

    throw new Error("Unsupported condition type");
  }
}
