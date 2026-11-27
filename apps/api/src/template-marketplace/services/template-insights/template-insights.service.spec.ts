import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MarketplaceTemplateRow } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import type { TemplateViewEventRepository } from "@src/template-marketplace/repositories/template-view-event/template-view-event.repository";
import type { TemplateWriteAccessService } from "@src/template-marketplace/services/template-write-access/template-write-access.service";
import { TemplateInsightsService } from "./template-insights.service";

const NOW = new Date("2026-11-27T10:00:00Z");

describe(TemplateInsightsService.name, () => {
  it("reads the template's mainnet usage since the start of the previous period and builds the insights from it", async () => {
    const { service, templateWriteAccessService, templateUsageEventRepository, templateViewEventRepository, template } = setup();
    templateViewEventRepository.countDailyViewers.mockResolvedValue([{ day: "2026-11-27", kind: "page_view", viewers: 3 }]);
    templateUsageEventRepository.countDailyDeployCohorts.mockResolvedValue([{ day: "2026-11-26", deploys: 2, leases: 1, decidedLeases: 1, stillRunning: 1 }]);
    templateUsageEventRepository.countDailyForks.mockResolvedValue([{ day: "2026-11-25", forks: 1 }]);
    templateUsageEventRepository.countDeployCohortsByVersion.mockResolvedValue([{ version: 1, deploys: 2, leases: 1, decidedLeases: 1, stillRunning: 1 }]);

    const insights = await service.getInsights(template.id, 7, NOW);

    expect(templateWriteAccessService.findWritable).toHaveBeenCalledWith(template.id, "update");
    expect(templateViewEventRepository.countDailyViewers).toHaveBeenCalledWith({ templateId: template.id, network: "mainnet", since: "2026-11-14" });
    expect(templateUsageEventRepository.countDailyDeployCohorts).toHaveBeenCalledWith(template.id, "2026-11-14");
    expect(templateUsageEventRepository.countDailyForks).toHaveBeenCalledWith(template.id, "2026-11-14");
    expect(templateUsageEventRepository.countDeployCohortsByVersion).toHaveBeenCalledWith(template.id);
    expect(insights).toMatchObject({
      days: 7,
      from: "2026-11-21",
      to: "2026-11-27",
      current: { views: 3, deploys: 2, leases: 1, stillRunning: 1, forks: 1 },
      versions: [{ version: 1, deploys: 2 }]
    });
  });

  it("refuses a caller who may not change the template, before reading any usage", async () => {
    const { service, templateWriteAccessService, templateUsageEventRepository, template } = setup();
    templateWriteAccessService.findWritable.mockRejectedValue(createError(403, "You cannot change this template"));

    await expect(service.getInsights(template.id, 30, NOW)).rejects.toMatchObject({ status: 403 });
    expect(templateUsageEventRepository.countDailyDeployCohorts).not.toHaveBeenCalled();
  });

  function setup() {
    const template = mock<MarketplaceTemplateRow>({ id: faker.string.uuid() });
    const templateWriteAccessService = mock<TemplateWriteAccessService>();
    templateWriteAccessService.findWritable.mockResolvedValue(template);
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    templateUsageEventRepository.countDailyDeployCohorts.mockResolvedValue([]);
    templateUsageEventRepository.countDailyForks.mockResolvedValue([]);
    templateUsageEventRepository.countDeployCohortsByVersion.mockResolvedValue([]);
    const templateViewEventRepository = mock<TemplateViewEventRepository>();
    templateViewEventRepository.countDailyViewers.mockResolvedValue([]);
    const service = new TemplateInsightsService(templateWriteAccessService, templateUsageEventRepository, templateViewEventRepository);

    return { service, templateWriteAccessService, templateUsageEventRepository, templateViewEventRepository, template };
  }
});
