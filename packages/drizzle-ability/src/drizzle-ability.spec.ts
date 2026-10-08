import type { AnyAbility, MongoAbility, MongoQuery, RawRuleOf } from "@casl/ability";
import { createMongoAbility, ForbiddenError, PureAbility } from "@casl/ability";
import type { Condition } from "@ucast/core";
import { CompoundCondition, DocumentCondition, FieldCondition } from "@ucast/core";
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { integer, PgDialect, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { DrizzleAbility } from "./drizzle-ability";

const deployments = pgTable("deployments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id"),
  projectId: text("project_id"),
  replicas: integer("replicas").notNull(),
  closedAt: timestamp("closed_at")
});

describe(DrizzleAbility.name, () => {
  describe("whereAccessibleBy", () => {
    it("returns the given clause untouched when the allowing rule has no conditions", () => {
      const { drizzleAbility } = setup({ rules: [{ action: "read", subject: "Deployment" }] });
      const where = eq(deployments.id, "d1");

      expect(drizzleAbility.whereAccessibleBy(where)).toBe(where);
      expect(drizzleAbility.whereAccessibleBy()).toBeUndefined();
    });

    it("filters by equality", () => {
      const { drizzleAbility } = setup({ rules: [allow({ userId: "u1" })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: '"deployments"."user_id" = $1', params: ["u1"] });
    });

    it.each([
      ["$ne", "<>"],
      ["$gt", ">"],
      ["$gte", ">="],
      ["$lt", "<"],
      ["$lte", "<="]
    ])("compares with %s as %s", (operator, comparison) => {
      const { drizzleAbility } = setup({ rules: [allow({ replicas: { [operator]: 2 } })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: `"deployments"."replicas" ${comparison} $1`, params: [2] });
    });

    it("matches a null condition with IS NULL", () => {
      const { drizzleAbility } = setup({ rules: [allow({ closedAt: null })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: '"deployments"."closed_at" is null', params: [] });
    });

    it("matches a $ne null condition with IS NOT NULL", () => {
      const { drizzleAbility } = setup({ rules: [allow({ closedAt: { $ne: null } })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: '"deployments"."closed_at" is not null', params: [] });
    });

    it("matches $in with IN", () => {
      const { drizzleAbility } = setup({ rules: [allow({ projectId: { $in: ["p1", "p2"] } })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: '"deployments"."project_id" in ($1, $2)', params: ["p1", "p2"] });
    });

    it("matches no row for an empty $in", () => {
      const { drizzleAbility } = setup({ rules: [allow({ projectId: { $in: [] } })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: "false", params: [] });
    });

    it("matches $nin with NOT IN", () => {
      const { drizzleAbility } = setup({ rules: [allow({ projectId: { $nin: ["p1", "p2"] } })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: '"deployments"."project_id" not in ($1, $2)', params: ["p1", "p2"] });
    });

    it("matches every row for an empty $nin", () => {
      const { drizzleAbility } = setup({ rules: [allow({ projectId: { $nin: [] } })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({ sql: "true", params: [] });
    });

    it("requires every field of a rule", () => {
      const { drizzleAbility } = setup({ rules: [allow({ organizationId: "o1", projectId: "p1" })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({
        sql: '("deployments"."organization_id" = $1 and "deployments"."project_id" = $2)',
        params: ["o1", "p1"]
      });
    });

    it("accepts a row matching any allowing rule", () => {
      const { drizzleAbility } = setup({ rules: [allow({ userId: "u1" }), allow({ organizationId: "o1" })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({
        sql: '("deployments"."organization_id" = $1 or "deployments"."user_id" = $2)',
        params: ["o1", "u1"]
      });
    });

    it("excludes rows matching an inverted rule", () => {
      const { drizzleAbility } = setup({ rules: [allow({ organizationId: "o1" }), forbid({ userId: "u2" })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({
        sql: '(not "deployments"."user_id" = $1 and "deployments"."organization_id" = $2)',
        params: ["u2", "o1"]
      });
    });

    it("excludes rows matching every field of an inverted rule", () => {
      const { drizzleAbility } = setup({ rules: [{ action: "read", subject: "Deployment" }, forbid({ organizationId: "o1", projectId: "p1" })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy())).toEqual({
        sql: 'not ("deployments"."organization_id" = $1 and "deployments"."project_id" = $2)',
        params: ["o1", "p1"]
      });
    });

    it("joins the given clause with the rules", () => {
      const { drizzleAbility } = setup({ rules: [allow({ userId: "u1" })] });

      expect(toQuery(drizzleAbility.whereAccessibleBy(eq(deployments.id, "d1")))).toEqual({
        sql: '("deployments"."id" = $1 and "deployments"."user_id" = $2)',
        params: ["d1", "u1"]
      });
    });
  });

  describe("constructor", () => {
    it("throws a ForbiddenError when the ability lacks the action on the subject", () => {
      expect(() => setup({ rules: [{ action: "read", subject: "Deployment" }], action: "delete" })).toThrow(ForbiddenError);
    });

    it("throws when a rule names a field the table does not have", () => {
      expect(() => setup({ rules: [allow({ ownerId: "u1" })] })).toThrow('Rule field "ownerId" does not exist on table "deployments"');
    });

    it("throws on a field operator it cannot translate", () => {
      expect(() => setup({ rules: [allow({ userId: { $regex: "^u" } })] })).toThrow('Unsupported operator "regex"');
    });

    it("throws when a rule has no AST", () => {
      expect(() => setup({ ability: abilityWithAst(undefined) })).toThrow("Unable to create query without AST");
    });

    it("throws on a condition it cannot translate", () => {
      expect(() => setup({ ability: abilityWithAst(new DocumentCondition("where", () => true)) })).toThrow('Unsupported condition "where"');
    });

    it("throws on a compound operator it cannot translate", () => {
      const ast = new CompoundCondition("nor", [new FieldCondition("eq", "userId", "u1")]);

      expect(() => setup({ ability: abilityWithAst(ast) })).toThrow('Unsupported operator "nor"');
    });

    it("throws on a compound condition without children", () => {
      expect(() => setup({ ability: abilityWithAst(new CompoundCondition("and", [])) })).toThrow('Unable to combine an empty "and" condition');
    });
  });

  describe("throwUnlessCanExecute", () => {
    it("accepts a payload the rules allow", () => {
      const { drizzleAbility } = setup({ rules: [allow({ userId: "u1" })] });

      expect(() => drizzleAbility.throwUnlessCanExecute({ userId: "u1" })).not.toThrow();
    });

    it("throws a ForbiddenError for a payload the rules refuse", () => {
      const { drizzleAbility } = setup({ rules: [allow({ userId: "u1" })] });

      expect(() => drizzleAbility.throwUnlessCanExecute({ userId: "u2" })).toThrow(ForbiddenError);
    });
  });

  function allow(conditions: MongoQuery): RawRuleOf<MongoAbility> {
    return { action: "read", subject: "Deployment", conditions };
  }

  function forbid(conditions: MongoQuery): RawRuleOf<MongoAbility> {
    return { ...allow(conditions), inverted: true };
  }

  function abilityWithAst(ast: Condition | undefined): AnyAbility {
    return new PureAbility([{ action: "read", subject: "Deployment", conditions: {} }], {
      conditionsMatcher: () => Object.assign(() => true, { ast })
    });
  }

  function toQuery(clause: SQL | undefined) {
    if (!clause) {
      throw new Error("Expected a where clause");
    }

    const { sql, params } = new PgDialect().sqlToQuery(clause);

    return { sql, params };
  }

  function setup(input: { rules?: RawRuleOf<MongoAbility>[]; ability?: AnyAbility; action?: string }) {
    const ability = input.ability ?? createMongoAbility(input.rules ?? []);
    const drizzleAbility = new DrizzleAbility(deployments, ability, input.action ?? "read", "Deployment");

    return { drizzleAbility };
  }
});
