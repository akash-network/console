import type { ValidationError } from "@akashnetwork/chain-sdk";
import { subject } from "@casl/ability";
import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { generateManifestReportingBuildFailures } from "@src/deployment/utils/sdl-manifest/sdl-manifest";
import type { TemplateHardware } from "@src/template/types/template";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { findAskedValueIssues } from "@src/template-marketplace/lib/asked-values/find-asked-value-issues";
import { findSecretValueIssues } from "@src/template-marketplace/lib/asked-values/find-secret-value-issues";
import {
  MarketplaceTemplateRepository,
  type MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import {
  TEMPLATE_VERSION_CONFLICT_ERROR_CODE,
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
  baseVersion: number;
};

const TEMPLATE_INVALID_ERROR_CODE = "template_invalid";

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

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIssue({ keyword, message }: ValidationError): string {
  return keyword === "yaml" ? `${UNREADABLE_SDL_ISSUE}: ${message}` : message;
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
    private readonly txService: TxService
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
        userId,
        authorId,
        projectId,
        copiedFromId: input.copiedFromId,
        sdl: input.sdl,
        description: input.readme ?? null,
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
    const template = await this.#findWritable(id, "update");
    this.#assertValid(input.sdl, input.askedValues);
    const hardware = summarizeTemplateHardware(input.sdl);
    const createdById = this.authService.currentUser.id;

    const { imageDigests: _imageDigests, ...version } = await this.txService.transaction(async () => {
      const base = await this.templateVersionRepository.findByTemplateAndVersion(id, input.baseVersion);

      if (!base) {
        throw createError(409, "The template has a newer version", { errorCode: TEMPLATE_VERSION_CONFLICT_ERROR_CODE });
      }

      const readme = input.readme === undefined ? base.readme : input.readme;
      const appended = await this.templateVersionRepository.appendVersion({
        templateId: id,
        sdl: input.sdl,
        readme,
        askedValues: input.askedValues,
        resources: hardware ?? null,
        createdById,
        expectedCurrentVersionId: base.id
      });
      await this.marketplaceTemplateRepository.mirrorVersion(id, {
        sdl: input.sdl,
        description: readme ?? template.description,
        ...legacyHardwareOf(hardware)
      });

      return appended;
    });

    return version;
  }

  async #findWritable(id: string, action: "update"): Promise<MarketplaceTemplateRow> {
    const template = await this.marketplaceTemplateService.findReadable(id);
    assert(this.authService.ability.can(action, subject("Template", { ...template })), 403, "You cannot change this template");

    return template;
  }

  #assertValid(sdl: string, askedValues: AskedValue[]): void {
    const sdlIssues = this.#findSdlIssues(sdl);
    const issues = sdlIssues.length > 0 ? sdlIssues : [...findAskedValueIssues(sdl, askedValues), ...findSecretValueIssues(sdl, askedValues)];

    if (issues.length > 0) {
      throw createError(400, issues.join("; "), { errorCode: TEMPLATE_INVALID_ERROR_CODE, data: { issues } });
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
