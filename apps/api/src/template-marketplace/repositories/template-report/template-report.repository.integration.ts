import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { TemplateReportRepository } from "./template-report.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedTemplate, seedTemplateVersion } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(TemplateReportRepository.name, () => {
  describe("fileUnlessReported", () => {
    it("files an open report against the version named and answers its id, reason and time", async () => {
      const { repository, template, version, reporter, organization } = await setup();

      const filed = await repository.fileUnlessReported({
        templateId: template.id,
        templateVersionId: version.id,
        reporterUserId: reporter.id,
        reporterOrganizationId: organization.id,
        reason: "malware_or_miner",
        details: "It downloads a miner."
      });

      expect(filed).toEqual({ id: expect.any(String), reason: "malware_or_miner", createdAt: expect.any(Date) });
      expect(await reportsOf(template.id)).toEqual([
        {
          id: filed!.id,
          templateId: template.id,
          templateVersionId: version.id,
          reporterUserId: reporter.id,
          reporterOrganizationId: organization.id,
          reason: "malware_or_miner",
          details: "It downloads a miner.",
          status: "open",
          assignee: null,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: filed!.createdAt
        }
      ]);
    });

    it("answers nothing for a second report of the same version by the same reporter, and keeps the first", async () => {
      const { repository, template, version, reporter, organization } = await setup();
      const report = { templateId: template.id, templateVersionId: version.id, reporterUserId: reporter.id, reporterOrganizationId: organization.id };
      const first = await repository.fileUnlessReported({ ...report, reason: "spam", details: null });

      const second = await repository.fileUnlessReported({ ...report, reason: "broken", details: "Again." });

      expect(second).toBeUndefined();
      expect(await reportsOf(template.id)).toMatchObject([{ id: first!.id, reason: "spam", details: null }]);
    });

    it("files a report of a later version by the same reporter, and one of the same version by another", async () => {
      const { repository, template, version, reporter, organization } = await setup();
      const [later, other] = [await seedTemplateVersion({ templateId: template.id, version: 2 }), await seedUser()];
      const report = { templateId: template.id, reporterOrganizationId: organization.id, reason: "spam" as const, details: null };
      await repository.fileUnlessReported({ ...report, templateVersionId: version.id, reporterUserId: reporter.id });

      const ofLaterVersion = await repository.fileUnlessReported({ ...report, templateVersionId: later.id, reporterUserId: reporter.id });
      const byAnotherReporter = await repository.fileUnlessReported({ ...report, templateVersionId: version.id, reporterUserId: other.id });

      expect(ofLaterVersion).toBeDefined();
      expect(byAnotherReporter).toBeDefined();
      expect(await reportsOf(template.id)).toHaveLength(3);
    });

    it("keeps a report without its reporter once the reporter's account is deleted", async () => {
      const { repository, template, version, reporter, organization } = await setup();
      await repository.fileUnlessReported({
        templateId: template.id,
        templateVersionId: version.id,
        reporterUserId: reporter.id,
        reporterOrganizationId: organization.id,
        reason: "leaks_secrets",
        details: null
      });

      await container.resolve(UserRepository).deleteById(reporter.id);

      expect(await reportsOf(template.id)).toMatchObject([{ reporterUserId: null, reason: "leaks_secrets" }]);
    });
  });

  async function reportsOf(templateId: string) {
    const reports = resolveTable("TemplateReports");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(reports).where(eq(reports.templateId, templateId));
  }

  async function setup() {
    const [template, reporter, organization] = await Promise.all([seedTemplate({ visibility: "public" }), seedUser(), seedOrganization()]);
    const version = await seedTemplateVersion({ templateId: template.id });

    return { repository: container.resolve(TemplateReportRepository), template, version, reporter, organization };
  }
});
