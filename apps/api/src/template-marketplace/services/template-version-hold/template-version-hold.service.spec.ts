import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { OFFICIAL_TEMPLATE_HOLD_REASON } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import type { TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import type { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateVersionHoldService } from "./template-version-hold.service";

const CURRENT_SDL = JSON.stringify({ services: { web: { image: "acme/web:1" } } });
const SAFE_SDL = JSON.stringify({ services: { web: { image: "acme/web:2" } } });
const RISKY_SDL = JSON.stringify({ services: { web: { image: "other/web:1", expose: [{ port: 22, to: [{ global: true }] }] } } });

describe(TemplateVersionHoldService.name, () => {
  it("holds every version of an Official template, however few people deploy it", async () => {
    const { service, template, templateUsageEventRepository } = setup({ isOfficial: true, weeklyDeployers: 0 });

    expect(await service.findHoldReasons(template, CURRENT_SDL, SAFE_SDL)).toEqual([OFFICIAL_TEMPLATE_HOLD_REASON]);
    expect(templateUsageEventRepository.countWeeklyDeployers).not.toHaveBeenCalled();
  });

  it("adds what a version of an Official template changes to the reason every version of one waits for", async () => {
    const { service, template } = setup({ isOfficial: true });

    const reasons = await service.findHoldReasons(template, CURRENT_SDL, RISKY_SDL);

    expect(reasons.map(reason => reason.kind)).toEqual(["official_template", "image_repository_changed", "global_port_added"]);
  });

  it("lets a version that changes nothing risky go live without counting deployers", async () => {
    const { service, template, templateUsageEventRepository } = setup({ weeklyDeployers: 1000 });

    expect(await service.findHoldReasons(template, CURRENT_SDL, SAFE_SDL)).toEqual([]);
    expect(templateUsageEventRepository.countWeeklyDeployers).not.toHaveBeenCalled();
  });

  it("holds a risky change once the template has as many weekly deployers outside its organization as make it popular", async () => {
    const { service, template, templateUsageEventRepository } = setup({ weeklyDeployers: 25, popularFrom: 25 });

    const reasons = await service.findHoldReasons(template, CURRENT_SDL, RISKY_SDL);

    expect(reasons).toMatchObject([
      { kind: "image_repository_changed", service: "web", image: "other/web:1", previousImage: "acme/web:1" },
      { kind: "global_port_added", service: "web", port: 22, protocol: "tcp" }
    ]);
    expect(templateUsageEventRepository.countWeeklyDeployers).toHaveBeenCalledWith(template.id, template.organizationId);
  });

  it("lets a risky change go live on a template one deployer short of popular", async () => {
    const { service, template } = setup({ weeklyDeployers: 24, popularFrom: 25 });

    expect(await service.findHoldReasons(template, CURRENT_SDL, RISKY_SDL)).toEqual([]);
  });

  it("reads what makes a template popular from the configuration", async () => {
    const { service, template } = setup({ weeklyDeployers: 3, popularFrom: 3 });

    expect(await service.findHoldReasons(template, CURRENT_SDL, RISKY_SDL)).toHaveLength(2);
  });

  function setup(input: { isOfficial?: boolean; weeklyDeployers?: number; popularFrom?: number } = {}) {
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    templateUsageEventRepository.countWeeklyDeployers.mockResolvedValue(input.weeklyDeployers ?? 0);
    const config = mock<TemplateMarketplaceConfig>({ TEMPLATE_POPULAR_WEEKLY_DEPLOYERS: input.popularFrom ?? 25 });
    const service = new TemplateVersionHoldService(templateUsageEventRepository, config);
    const template = { id: faker.string.uuid(), organizationId: faker.string.uuid(), isOfficial: input.isOfficial ?? false };

    return { service, template, templateUsageEventRepository };
  }
});
