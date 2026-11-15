import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { AssistantTurnTraceRepository } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import type { UserOutput } from "@src/user/repositories";
import { AssistantProblemReportRepository } from "./assistant-problem-report.repository";

import { seedAssistantProblemReport, seedAssistantTurnTrace, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(AssistantProblemReportRepository.name, () => {
  describe("create", () => {
    it("stores a report as new and reads it back", async () => {
      const { repository, user } = await setup();
      const organization = await seedOrganization();
      const trace = await seedAssistantTurnTrace({ userId: user.id });
      const input = {
        userId: user.id,
        organizationId: organization.id,
        conversationId: trace.conversationId,
        turnTraceId: trace.id,
        note: "The answer was wrong",
        transcript: [{ role: "user" as const, content: "Why no bids?" }],
        consentCopyVersion: "2026-11-14"
      };

      const report = await repository.create(input);

      expect(await repository.findById(report.id)).toEqual({
        ...input,
        id: report.id,
        status: "new",
        classificationType: null,
        classificationSummary: null,
        sentimentScore: null,
        endedStuck: null,
        classifiedAt: null,
        classificationAttempts: 0,
        classificationFailedAt: null,
        themeId: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it("refuses a report for another user under the user's ability", async () => {
      const { repository, user } = await setup();
      const other = await seedUser();

      await expect(
        asUser(user, ability =>
          repository.accessibleBy(ability, "create").create({ userId: other.id, conversationId: faker.string.uuid(), consentCopyVersion: "v1" })
        )
      ).rejects.toThrow();
    });

    it("keeps the report and clears its turn when the turn trace is deleted", async () => {
      const { repository, user } = await setup();
      const trace = await seedAssistantTurnTrace({ userId: user.id });
      const report = await seedAssistantProblemReport({ userId: user.id, turnTraceId: trace.id });

      await container.resolve(AssistantTurnTraceRepository).deleteAllOf(user.id);

      expect(await repository.findById(report.id)).toMatchObject({ turnTraceId: null });
    });
  });

  describe("deleteAllOf", () => {
    it("deletes the user's reports only and answers the themes they belonged to", async () => {
      const { repository, user } = await setup();
      const other = await seedUser();
      const theme = await seedFeedbackTheme();
      const themed = await seedAssistantProblemReport({ userId: user.id, themeId: theme.id });
      const unthemed = await seedAssistantProblemReport({ userId: user.id });
      const kept = await seedAssistantProblemReport({ userId: other.id });

      expect(await asUser(user, ability => repository.accessibleBy(ability, "delete").deleteAllOf(user.id))).toEqual([theme.id]);
      expect(await repository.findById(themed.id)).toBeUndefined();
      expect(await repository.findById(unthemed.id)).toBeUndefined();
      expect(await repository.findById(kept.id)).toBeDefined();
    });

    it("deletes nothing of another user under the user's ability", async () => {
      const { repository, user } = await setup();
      const other = await seedUser();
      const kept = await seedAssistantProblemReport({ userId: other.id });

      expect(await asUser(user, ability => repository.accessibleBy(ability, "delete").deleteAllOf(other.id))).toEqual([]);
      expect(await repository.findById(kept.id)).toBeDefined();
    });
  });

  describe("findUnclassifiedIds", () => {
    it("answers reports neither classified nor given up on, oldest first, up to the limit", async () => {
      const { repository, user } = await setup();
      const oldest = await seedAssistantProblemReport({ userId: user.id, createdAt: subDays(new Date(), 400) });
      const older = await seedAssistantProblemReport({ userId: user.id, createdAt: subDays(new Date(), 399) });
      await seedAssistantProblemReport({ userId: user.id, createdAt: subDays(new Date(), 398) });
      await seedAssistantProblemReport({ userId: user.id, createdAt: subDays(new Date(), 401), classifiedAt: new Date() });
      await seedAssistantProblemReport({ userId: user.id, createdAt: subDays(new Date(), 401), classificationFailedAt: new Date() });

      expect(await repository.findUnclassifiedIds(2)).toEqual([oldest.id, older.id]);
    });
  });

  describe("recordFailedClassification", () => {
    it("counts each failed attempt and gives up on the last one", async () => {
      const { repository, user } = await setup();
      const report = await seedAssistantProblemReport({ userId: user.id });

      expect(await repository.recordFailedClassification(report.id, 2)).toEqual({ attempts: 1, abandoned: false });
      expect(await repository.recordFailedClassification(report.id, 2)).toEqual({ attempts: 2, abandoned: true });
      expect(await repository.findById(report.id)).toMatchObject({ classificationAttempts: 2, classificationFailedAt: expect.any(Date) });
    });

    it("answers nothing for a report that is gone", async () => {
      const { repository } = await setup();

      expect(await repository.recordFailedClassification(faker.string.uuid(), 2)).toBeUndefined();
    });
  });

  function asUser<R>(user: UserOutput, run: (ability: ReturnType<AbilityService["getAbilityFor"]>) => Promise<R>) {
    const executionContextService = container.resolve(ExecutionContextService);

    return executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({}));
      return await run(container.resolve(AbilityService).getAbilityFor("REGULAR_USER", user));
    });
  }

  async function setup() {
    const user = await seedUser();
    const repository = container.resolve(AssistantProblemReportRepository);

    return { repository, user };
  }
});
