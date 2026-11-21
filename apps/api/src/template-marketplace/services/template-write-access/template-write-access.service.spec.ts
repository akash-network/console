import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type { MarketplaceTemplateService } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { TemplateWriteAccessService } from "./template-write-access.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const SWITCH_ORGANIZATION = { status: 403, message: "Switch to the template's organization to change it", errorCode: "organization_forbidden" };
const NOT_PERMITTED = { status: 403, message: "You cannot change this template" };
const IMPORTED_READ_ONLY = {
  status: 409,
  message: "This template is imported from the awesome-akash repository and can only be changed there",
  errorCode: "template_imported_read_only"
};

describe(TemplateWriteAccessService.name, () => {
  describe("findWritable", () => {
    it("answers the readable template the caller may change", async () => {
      const { service, template, marketplaceTemplateService } = setup();

      await expect(service.findWritable(template.id, "update")).resolves.toBe(template);
      expect(marketplaceTemplateService.findReadable).toHaveBeenCalledWith(template.id);
    });

    it("answers 404 for a template the caller cannot read, before judging the write", async () => {
      const { service, template, marketplaceTemplateService } = setup({ rules: [] });
      marketplaceTemplateService.findReadable.mockRejectedValue(createError(404, "Template not found"));

      await expect(service.findWritable(template.id, "update")).rejects.toMatchObject({ status: 404 });
    });

    it.each([
      { shape: "another organization is active", activeOrganizationId: faker.string.uuid() },
      { shape: "no organization is active", activeOrganizationId: null }
    ])("tells the caller to switch organization when $shape", async ({ activeOrganizationId }) => {
      const { service, template } = setup({ activeOrganizationId });

      await expect(service.findWritable(template.id, "update")).rejects.toMatchObject(SWITCH_ORGANIZATION);
    });

    it.each([
      { caller: "a member who may manage every template of its organization", activeOrganizationId: undefined },
      { caller: "a caller of another organization", activeOrganizationId: faker.string.uuid() },
      { caller: "a caller outside any organization", activeOrganizationId: null }
    ])("refuses an imported template to $caller with a conflict of its own, for an update and for a delete", async ({ activeOrganizationId }) => {
      const { service, template } = setup({ activeOrganizationId, importedRef: "akash-network-awesome-akash-comfyui" });

      await expect(service.findWritable(template.id, "update")).rejects.toMatchObject(IMPORTED_READ_ONLY);
      await expect(service.findWritable(template.id, "delete")).rejects.toMatchObject(IMPORTED_READ_ONLY);
    });

    it("refuses a caller whose rules allow another action only", async () => {
      const { service, template } = setup({ rules: [{ action: "update", subject: "Template" }] });

      await expect(service.findWritable(template.id, "delete")).rejects.toMatchObject(NOT_PERMITTED);
      await expect(service.findWritable(template.id, "update")).resolves.toBe(template);
    });
  });

  describe("lockWritable", () => {
    it("answers the locked row the caller may change", async () => {
      const { service, template, repository } = setup();

      await expect(service.lockWritable(template.id, "update")).resolves.toBe(template);
      expect(repository.findAndLockForWrite).toHaveBeenCalledWith(template.id);
    });

    it.each([
      { shape: "is gone", locked: null },
      { shape: "was removed", locked: { moderationStatus: "removed" as const } }
    ])("answers 404 when the template $shape by the time it is locked", async ({ locked }) => {
      const { service, template } = setup({ locked });

      await expect(service.lockWritable(template.id, "update")).rejects.toMatchObject({ status: 404, message: "Template not found" });
    });

    it("locks a hidden template for its editor", async () => {
      const { service, template } = setup({ locked: { moderationStatus: "hidden" } });

      await expect(service.lockWritable(template.id, "update")).resolves.toMatchObject({ id: template.id, moderationStatus: "hidden" });
    });

    it("refuses the write when the locked row is an imported template, whoever locks it", async () => {
      const { service, template } = setup({ locked: { importedRef: "akash-network-awesome-akash-comfyui" } });

      await expect(service.lockWritable(template.id, "update")).rejects.toMatchObject(IMPORTED_READ_ONLY);
      await expect(service.lockWritable(template.id, "delete")).rejects.toMatchObject(IMPORTED_READ_ONLY);
    });

    it("refuses the write when the template left the active organization after it was read", async () => {
      const { service, template } = setup({ locked: { organizationId: faker.string.uuid() } });

      await expect(service.lockWritable(template.id, "update")).rejects.toMatchObject(SWITCH_ORGANIZATION);
    });

    it("refuses the write when the locked row is outside the caller's rules", async () => {
      const projectId = faker.string.uuid();
      const { service, template } = setup({
        rules: [{ action: "update", subject: "Template", conditions: { projectId } }],
        locked: { projectId: faker.string.uuid() }
      });

      await expect(service.lockWritable(template.id, "update")).rejects.toMatchObject(NOT_PERMITTED);
    });
  });

  function setup(
    input: {
      rules?: RawRuleOf<MongoAbility>[];
      activeOrganizationId?: string | null;
      locked?: Partial<MarketplaceTemplateRow> | null;
      importedRef?: string;
    } = {}
  ) {
    const template = mock<MarketplaceTemplateRow>({
      id: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      moderationStatus: "active",
      importedRef: input.importedRef ?? null
    });
    const authService = mock<AuthService>();
    authService.ability = createMongoAbility<MongoAbility>(input.rules ?? [{ action: "manage", subject: "Template" }]);
    const repository = mock<MarketplaceTemplateRepository>();
    repository.findAndLockForWrite.mockResolvedValue(input.locked === null ? undefined : input.locked ? { ...pickRow(template), ...input.locked } : template);
    const marketplaceTemplateService = mock<MarketplaceTemplateService>();
    marketplaceTemplateService.findReadable.mockResolvedValue(template);
    const activeOrganizationId = input.activeOrganizationId === undefined ? template.organizationId : input.activeOrganizationId;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(activeOrganizationId ? createOrganizationContext({ organizationId: activeOrganizationId }) : undefined);
    const service = new TemplateWriteAccessService(repository, marketplaceTemplateService, authService, executionContextService);

    return { service, template, repository, marketplaceTemplateService };
  }

  function pickRow({ id, organizationId, moderationStatus, projectId, importedRef }: MarketplaceTemplateRow) {
    return mock<MarketplaceTemplateRow>({ id, organizationId, moderationStatus, projectId, importedRef });
  }
});
