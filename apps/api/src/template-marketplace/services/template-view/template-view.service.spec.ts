import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type {
  OrganizationMemberRepository,
  OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { MarketplaceTemplateRow } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type { TemplateViewEventRepository } from "@src/template-marketplace/repositories/template-view-event/template-view-event.repository";
import type { MarketplaceTemplateService } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import type { UserOutput } from "@src/user/repositories";
import { TemplateViewService } from "./template-view.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const NOW = new Date("2026-11-27T15:00:00Z");

describe(TemplateViewService.name, () => {
  it("counts the viewer under a key of their id and the day, on the API's network", async () => {
    const { service, templateViewEventRepository, template, user } = setup({ visibility: "public" });

    await service.recordView(template.id, "configure_open", NOW);

    expect(templateViewEventRepository.recordOncePerDay).toHaveBeenCalledWith({
      templateId: template.id,
      kind: "configure_open",
      viewerKey: createHash("sha256").update(`2026-11-27:${user.id}`).digest("hex"),
      network: "sandbox",
      viewedOn: "2026-11-27"
    });
  });

  it("skips a member of the organization that publishes a public template", async () => {
    const { service, templateViewEventRepository, organizationMemberRepository, template, user } = setup({ visibility: "public", isMember: true });

    await service.recordView(template.id, "page_view", NOW);

    expect(organizationMemberRepository.unscoped).toHaveBeenCalledWith("template-view-counting");
    expect(organizationMemberRepository.findWithUserByUserId).toHaveBeenCalledWith(template.organizationId, user.id);
    expect(templateViewEventRepository.recordOncePerDay).not.toHaveBeenCalled();
  });

  it.each<TemplateVisibility>(["organization", "private"])("counts members viewing an %s template, who are all its viewers", async visibility => {
    const { service, templateViewEventRepository, organizationMemberRepository, template } = setup({ visibility, isMember: true });

    await service.recordView(template.id, "page_view", NOW);

    expect(organizationMemberRepository.findWithUserByUserId).not.toHaveBeenCalled();
    expect(templateViewEventRepository.recordOncePerDay).toHaveBeenCalled();
  });

  it("refuses a template the caller may not read", async () => {
    const { service, marketplaceTemplateService, templateViewEventRepository, template } = setup({ visibility: "private" });
    marketplaceTemplateService.findReadable.mockRejectedValue(createError(404, "Template not found"));

    await expect(service.recordView(template.id, "page_view", NOW)).rejects.toMatchObject({ status: 404 });
    expect(templateViewEventRepository.recordOncePerDay).not.toHaveBeenCalled();
  });

  function setup(input: { visibility: TemplateVisibility; isMember?: boolean }) {
    const template = mock<MarketplaceTemplateRow>({ id: faker.string.uuid(), organizationId: faker.string.uuid(), visibility: input.visibility });
    const user = mock<UserOutput>({ id: faker.string.uuid() });
    const marketplaceTemplateService = mock<MarketplaceTemplateService>();
    marketplaceTemplateService.findReadable.mockResolvedValue(template);
    const templateViewEventRepository = mock<TemplateViewEventRepository>();
    templateViewEventRepository.recordOncePerDay.mockResolvedValue(true);
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.unscoped.mockReturnValue(organizationMemberRepository);
    organizationMemberRepository.findWithUserByUserId.mockResolvedValue(input.isMember ? mock<OrganizationMemberWithUser>() : undefined);
    const authService = mock<AuthService>({ currentUser: user });
    const coreConfig = mockConfigService<CoreConfigService>({ NETWORK: "sandbox" });
    const service = new TemplateViewService(marketplaceTemplateService, templateViewEventRepository, organizationMemberRepository, authService, coreConfig);

    return { service, marketplaceTemplateService, templateViewEventRepository, organizationMemberRepository, template, user };
  }
});
