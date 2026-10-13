import { DrizzleAbility } from "@akashnetwork/drizzle-ability";
import type { LoggerService } from "@akashnetwork/logging";
import type { AnyAbility, MongoAbility, RawRuleOf } from "@casl/ability";
import { createMongoAbility, ForbiddenError, subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DeploymentSettings } from "@src/deployment/model-schemas";
import { ShadowedAbility } from "./shadowed-ability";

describe(ShadowedAbility.name, () => {
  it("answers from the legacy rules and reports a check only the organization rules allow", () => {
    const { ability, logger, organizationId } = setup();

    const allowed = ability.can("read", subject("DeploymentSetting", { userId: faker.string.uuid(), organizationId }));

    expect(allowed).toBe(false);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
      event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
      action: "read",
      subjectType: "DeploymentSetting",
      allowedBy: "organization"
    });
  });

  it("answers from the legacy rules and reports a check only the legacy rules allow", () => {
    const { ability, logger, userId } = setup();

    const allowed = ability.can("update", subject("DeploymentSetting", { userId, organizationId: null }));

    expect(allowed).toBe(true);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
      event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
      action: "update",
      subjectType: "DeploymentSetting",
      allowedBy: "legacy"
    });
  });

  it("reports nothing when both rule sets agree", () => {
    const { ability, logger, userId, organizationId } = setup();

    const ownRowAllowed = ability.can("read", subject("DeploymentSetting", { userId, organizationId }));
    const foreignRowAllowed = ability.can("read", subject("DeploymentSetting", { userId: faker.string.uuid(), organizationId: faker.string.uuid() }));

    expect(ownRowAllowed).toBe(true);
    expect(foreignRowAllowed).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("compares checks made on a subject type alone", () => {
    const { ability, logger } = setup({ organizationRules: [] });

    const allowed = ability.can("read", "DeploymentSetting");

    expect(allowed).toBe(true);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
      event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
      action: "read",
      subjectType: "DeploymentSetting",
      allowedBy: "legacy"
    });
  });

  it("compares the checks ForbiddenError makes and keeps the legacy refusal", () => {
    const { ability, logger, organizationId } = setup();

    expect(() => ForbiddenError.from(ability).throwUnlessCan("delete", subject("DeploymentSetting", { userId: faker.string.uuid(), organizationId }))).toThrow(
      ForbiddenError
    );
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
      event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
      action: "delete",
      subjectType: "DeploymentSetting",
      allowedBy: "organization"
    });
  });

  it("compares the create check of DrizzleAbility and keeps the legacy permission", () => {
    const { ability, logger, userId } = setup();
    const drizzleAbility = new DrizzleAbility(DeploymentSettings, ability, "create", "DeploymentSetting");
    logger.warn.mockClear();

    expect(() => drizzleAbility.throwUnlessCanExecute({ userId, dseq: "1", organizationId: null })).not.toThrow();
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
      event: "ORGANIZATION_ABILITY_SHADOW_MISMATCH",
      action: "create",
      subjectType: "DeploymentSetting",
      allowedBy: "legacy"
    });
  });

  it("builds query filters from the legacy rules only", () => {
    const { ability, userId } = setup();

    const where = new DrizzleAbility(DeploymentSettings, ability, "read", "DeploymentSetting").whereAccessibleBy();
    const query = new PgDialect().sqlToQuery(where!);

    expect(query.sql).toContain('"user_id"');
    expect(query.sql).not.toContain("organization_id");
    expect(query.params).toEqual([userId]);
  });

  it("keeps the legacy answer and reports the failure when the organization ability throws", () => {
    const error = new Error("organization ability failed");
    const organizationAbility = mock<AnyAbility>({
      can: vi.fn(() => {
        throw error;
      })
    });
    const { ability, logger, userId } = setup({ organizationAbility });

    const allowed = ability.can("read", subject("DeploymentSetting", { userId }));

    expect(allowed).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ event: "ORGANIZATION_ABILITY_SHADOW_FAILED", action: "read", subjectType: "DeploymentSetting", error });
  });

  function setup(input: { organizationRules?: RawRuleOf<MongoAbility>[]; organizationAbility?: AnyAbility } = {}) {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();
    const logger = mock<LoggerService>();
    const organizationAbility =
      input.organizationAbility ?? createMongoAbility(input.organizationRules ?? [{ action: "manage", subject: "DeploymentSetting", conditions: { organizationId } }]);
    const ability = new ShadowedAbility([{ action: "manage", subject: "DeploymentSetting", conditions: { userId } }], organizationAbility, logger);

    return { ability, logger, userId, organizationId };
  }
});
