import type { ValidationError } from "@akashnetwork/chain-sdk";
import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { SdlService, type YamlErrorParams } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { generateManifestReportingBuildFailures } from "@src/deployment/utils/sdl-manifest/sdl-manifest";
import type { TemplateHardware } from "@src/template/types/template";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { findAskedValueIssues } from "@src/template-marketplace/lib/asked-values/find-asked-value-issues";
import { findSecretValueIssues } from "@src/template-marketplace/lib/asked-values/find-secret-value-issues";
import type { TemplateCategory, TemplateIcon } from "@src/template-marketplace/lib/template-catalog/template-catalog";
import { createTemplateInvalidError } from "@src/template-marketplace/lib/template-invalid/template-invalid-error";
import { findTemplateWriteRefusal, type TemplateWriteAction } from "@src/template-marketplace/lib/template-write-access/template-write-access";
import {
  MarketplaceTemplateRepository,
  type MarketplaceTemplateRow,
  type TemplateSettingsUpdate
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import {
  TEMPLATE_VERSION_CONFLICT_ERROR_CODE,
  type TemplateVersionOutput,
  TemplateVersionRepository
} from "@src/template-marketplace/repositories/template-version/template-version.repository";
import {
  type MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  type PublishedTemplateVersion
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";

export type CreateUserTemplateInput = {
  title: string;
  summary?: string;
  icon?: TemplateIcon;
  categories?: TemplateCategory[];
  sdl: string;
  readme?: string;
  askedValues: AskedValue[];
  projectId?: string;
  copiedFromId?: string;
};

export type AppendUserTemplateVersionInput = {
  sdl: string;
  readme?: string | null;
  askedValues: AskedValue[];
  baseVersion?: number;
};

export type TemplateSettingsPatch = {
  title?: string;
  summary?: string | null;
  icon?: TemplateIcon | null;
  categories?: TemplateCategory[];
  visibility?: "private" | "organization";
};

type StoredTemplate = Omit<MarketplaceTemplateRow, "authorUsername" | "publisher">;

const BASE_VERSION_REQUIRED_ERROR_CODE = "template_base_version_required";
const TEMPLATE_NOT_FOUND = "Template not found";

const UNREADABLE_SDL_ISSUE = "The SDL could not be read";
const NO_SERVICES_ISSUE = "The SDL defines no services";

type LegacyHardware = { cpu: number; ram: number; storage: number };

/** The legacy columns hold millicpu and bytes, which is what the legacy template page reads. */
function legacyHardwareOf(hardware: TemplateHardware | undefined): LegacyHardware {
  return {
    cpu: Math.round((hardware?.cpu ?? 0) * 1000),
    ram: hardware?.memoryBytes ?? 0,
    storage: hardware?.storageBytes ?? 0
  };
}

/** A version saved before readmes were recorded shows the legacy description instead, so that is what an omitted readme carries forward. */
function readmeShownFor(base: TemplateVersionOutput | undefined, template: StoredTemplate): string | null {
  return base?.readme ?? (template.description || null);
}

/** The legacy `isPublic` flag must stay equal to a public visibility, and settings only set private or organization ones. */
function settingsUpdateOf({ summary, ...patch }: TemplateSettingsPatch): TemplateSettingsUpdate {
  return {
    ...patch,
    ...(summary !== undefined && { summary: summary || null }),
    ...(patch.visibility && { isPublic: false })
  };
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIssue({ keyword, message, params }: ValidationError): string {
  if (keyword !== "yaml") return message;

  const { reason, line, column }: Partial<YamlErrorParams> = params;
  const position = line && column ? ` (line ${line}, column ${column})` : "";

  return `${UNREADABLE_SDL_ISSUE}: ${reason}${position}`;
}

@singleton()
export class TemplateWriterService {
  constructor(
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly deploymentProjectService: DeploymentProjectService,
    private readonly sdlService: SdlService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  async create(input: CreateUserTemplateInput): Promise<MarketplaceTemplateOutput> {
    const ability = this.authService.ability;
    const { id: authorId, userId } = this.authService.currentUser;
    assert(userId && ability.can("create", "Template"), 403, "You cannot create templates");
    this.#assertValid(input.sdl, input.askedValues);

    if (input.copiedFromId) {
      await this.marketplaceTemplateService.findReadable(input.copiedFromId);
    }

    const projectId = await this.deploymentProjectService.resolveFilingProject(input.projectId, "Template");
    const hardware = summarizeTemplateHardware(input.sdl);
    const repository = this.marketplaceTemplateRepository.accessibleBy(ability, "create");

    const templateId = await this.txService.transaction(async () => {
      const id = await repository.createTemplate({
        title: input.title,
        summary: input.summary || null,
        icon: input.icon,
        categories: input.categories,
        userId,
        authorId,
        projectId,
        copiedFromId: input.copiedFromId,
        sdl: input.sdl,
        description: input.readme ?? "",
        ...legacyHardwareOf(hardware)
      });
      await this.templateVersionRepository.appendVersion({
        templateId: id,
        sdl: input.sdl,
        readme: input.readme ?? null,
        askedValues: input.askedValues,
        resources: hardware ?? null,
        createdById: authorId
      });

      return id;
    });

    return await this.marketplaceTemplateService.getTemplate(templateId);
  }

  /** The base version is checked again under the append lock, so of two editors saving from the same base only the first succeeds. */
  async appendVersion(id: string, input: AppendUserTemplateVersionInput): Promise<PublishedTemplateVersion> {
    await this.#findWritable(id, "update");
    this.#assertValid(input.sdl, input.askedValues);
    const hardware = summarizeTemplateHardware(input.sdl);
    const createdById = this.authService.currentUser.id;

    const { imageDigests: _imageDigests, ...version } = await this.txService.transaction(async () => {
      const template = await this.#lockWritable(id, "update");
      const base = template.currentVersionId ? await this.#findBaseVersion(id, input.baseVersion) : undefined;
      const readme = input.readme === undefined ? readmeShownFor(base, template) : input.readme;
      const appended = await this.templateVersionRepository.appendVersion({
        templateId: id,
        sdl: input.sdl,
        readme,
        askedValues: input.askedValues,
        resources: hardware ?? null,
        createdById,
        expectedCurrentVersionId: base?.id
      });
      await this.marketplaceTemplateRepository.mirrorVersion(id, {
        sdl: input.sdl,
        description: readme ?? "",
        ...legacyHardwareOf(hardware)
      });

      return appended;
    });

    return version;
  }

  async updateSettings(id: string, patch: TemplateSettingsPatch): Promise<MarketplaceTemplateOutput> {
    await this.#findWritable(id, "update");

    await this.txService.transaction(async () => {
      const template = await this.#lockWritable(id, "update");

      if (template.visibility === "private" && patch.visibility === "organization") {
        await this.#assertNoSecretValueSaved(template);
      }

      await this.marketplaceTemplateRepository.updateSettings(id, settingsUpdateOf(patch));
    });

    return await this.marketplaceTemplateService.getTemplate(id);
  }

  async delete(id: string): Promise<void> {
    await this.#findWritable(id, "delete");

    await this.txService.transaction(async () => {
      await this.#lockWritable(id, "delete");
      await this.marketplaceTemplateRepository.deleteTemplate(id);
    });
  }

  /** A version saved through the legacy route was never checked for secret values, so they are looked for before more members can read it. */
  async #assertNoSecretValueSaved(template: StoredTemplate): Promise<void> {
    const current = await this.templateVersionRepository.findCurrent(template.id);
    const issues = findSecretValueIssues(current?.sdl ?? template.sdl, current?.askedValues ?? []);

    if (issues.length > 0) throw createTemplateInvalidError(issues);
  }

  async #findBaseVersion(id: string, baseVersion: number | undefined): Promise<TemplateVersionOutput> {
    if (baseVersion === undefined) {
      throw createError(400, "Name the version this one was edited from", { errorCode: BASE_VERSION_REQUIRED_ERROR_CODE });
    }

    const base = await this.templateVersionRepository.findByTemplateAndVersion(id, baseVersion);

    if (!base) {
      throw createError(409, "The template has a newer version", { errorCode: TEMPLATE_VERSION_CONFLICT_ERROR_CODE });
    }

    return base;
  }

  /** Answers 404 for a template the caller may not read, before any 403, so its existence does not leak. */
  async #findWritable(id: string, action: TemplateWriteAction): Promise<void> {
    this.#assertWritable(await this.marketplaceTemplateService.findReadable(id), action);
  }

  /** The row read before the transaction may since have moved, been re-scoped or deleted, so the write is authorized again on the row it locks. */
  async #lockWritable(id: string, action: TemplateWriteAction): Promise<StoredTemplate> {
    const template = await this.marketplaceTemplateRepository.findAndLockForWrite(id);
    assert(template && template.moderationStatus !== "removed", 404, TEMPLATE_NOT_FOUND);
    this.#assertWritable(template, action);

    return template;
  }

  #assertWritable(template: StoredTemplate, action: TemplateWriteAction): void {
    const activeOrganizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;
    const refusal = findTemplateWriteRefusal(template, action, { ability: this.authService.ability, activeOrganizationId });

    if (refusal === "outside_active_organization") {
      throw createError(403, "Switch to the template's organization to change it", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    }

    assert(!refusal, 403, "You cannot change this template");
  }

  #assertValid(sdl: string, askedValues: AskedValue[]): void {
    const sdlIssues = this.#findSdlIssues(sdl);
    const issues = sdlIssues.length > 0 ? sdlIssues : [...findAskedValueIssues(sdl, askedValues), ...findSecretValueIssues(sdl, askedValues)];

    if (issues.length > 0) {
      throw createTemplateInvalidError(issues);
    }
  }

  /** Holds a template to what a deployment of it must pass, so a malformed env or credentials block cannot slip a plaintext secret past the value checks. */
  #findSdlIssues(sdl: string): string[] {
    const parsed = this.sdlService.parse(sdl);

    if (!parsed.ok) return parsed.value.map(toIssue);
    if (!isMapping(parsed.value)) return [UNREADABLE_SDL_ISSUE];
    if (!isMapping(parsed.value.services) || Object.keys(parsed.value.services).length === 0) return [NO_SERVICES_ISSUE];

    const referenceErrors = this.sdlReferenceService.validate(parsed.value);
    if (referenceErrors.length > 0) return referenceErrors.map(toIssue);

    const manifest = generateManifestReportingBuildFailures(parsed.value);

    return manifest.ok ? [] : manifest.value.map(toIssue);
  }
}
