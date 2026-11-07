import { subject } from "@casl/ability";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import {
  MarketplaceTemplateRepository,
  type MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import {
  type TemplateVersionOutput,
  TemplateVersionRepository,
  type TemplateVersionSummary
} from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";

export type PublishedTemplateVersion = Omit<TemplateVersionOutput, "imageDigests">;

export interface MarketplaceTemplateOutput {
  id: string;
  title: string;
  summary: string | null;
  icon: string | null;
  categories: string[];
  visibility: TemplateVisibility;
  isListed: boolean;
  isOfficial: boolean;
  moderationStatus: TemplateModerationStatus;
  copiedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { username: string } | null;
  /** A personal organization's slug is derived from its owner's internal id, so it is withheld. */
  publisher: { name: string; slug: string | null; type: OrganizationType } | null;
  /** Null only on a template an older API pod saved without a version, until it is saved again or healed. */
  currentVersion: PublishedTemplateVersion | null;
  canEdit: boolean;
}

const VERSION_NOT_FOUND = "Template version not found";

function withoutImageDigests({ imageDigests: _imageDigests, ...version }: TemplateVersionOutput): PublishedTemplateVersion {
  return version;
}

@singleton()
export class MarketplaceTemplateService {
  constructor(
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly authService: AuthService
  ) {}

  async getTemplate(id: string): Promise<MarketplaceTemplateOutput> {
    const template = await this.findReadable(id);
    const currentVersion = await this.templateVersionRepository.findCurrent(id);

    return {
      id: template.id,
      title: template.title,
      summary: template.summary,
      icon: template.icon,
      categories: template.categories,
      visibility: template.visibility,
      isListed: template.isListed,
      isOfficial: template.isOfficial,
      moderationStatus: template.moderationStatus,
      copiedFromId: template.copiedFromId,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      author: template.authorUsername ? { username: template.authorUsername } : null,
      publisher: template.publisher && { ...template.publisher, slug: template.publisher.type === "team" ? template.publisher.slug : null },
      currentVersion: currentVersion ? this.#withLegacyFallbacks(currentVersion, template) : null,
      canEdit: this.#canEdit(template)
    };
  }

  /** Earlier versions may hold what the template no longer publishes, such as a removed key, so only editors see past the current one. */
  async listVersions(id: string): Promise<TemplateVersionSummary[]> {
    const template = await this.findReadable(id);
    const versions = await this.templateVersionRepository.listByTemplate(id);

    return this.#canEdit(template) ? versions : versions.filter(version => version.id === template.currentVersionId);
  }

  async getVersion(id: string, version: number): Promise<PublishedTemplateVersion> {
    const template = await this.findReadable(id);
    const found = await this.templateVersionRepository.findByTemplateAndVersion(id, version);
    assert(found, 404, VERSION_NOT_FOUND);
    assert(found.id === template.currentVersionId || this.#canEdit(template), 404, VERSION_NOT_FOUND);

    return this.#withLegacyFallbacks(found, template);
  }

  /** Answers 404 rather than 403 for a template the caller may not read, so its existence does not leak. */
  async findReadable(id: string): Promise<MarketplaceTemplateRow> {
    const ability = this.authService.ability;
    const repository = ability.can("read", "Template") ? this.marketplaceTemplateRepository.accessibleBy(ability, "read") : this.marketplaceTemplateRepository;
    const template = await repository.findReadable(id);
    assert(template, 404, "Template not found");

    return template;
  }

  #withLegacyFallbacks(version: TemplateVersionOutput, template: MarketplaceTemplateRow): PublishedTemplateVersion {
    return {
      ...withoutImageDigests(version),
      readme: version.readme ?? (template.description || null),
      resources: version.resources ?? summarizeTemplateHardware(version.sdl) ?? null
    };
  }

  #canEdit(template: MarketplaceTemplateRow): boolean {
    return this.authService.ability.can("update", subject("Template", { ...template }));
  }
}
