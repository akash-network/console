import { subject } from "@casl/ability";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import { findTemplateWriteRefusal, isInActiveOrganization } from "@src/template-marketplace/lib/template-write-access/template-write-access";
import {
  MarketplaceTemplateRepository,
  type MarketplaceTemplateRow,
  type UserTemplateListRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import {
  NO_TEMPLATE_USAGE,
  TemplateUsageEventRepository,
  type TemplateUsageSummary
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import {
  type TemplateVersionOutput,
  TemplateVersionRepository,
  type TemplateVersionSummary
} from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";

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
  /** Withheld outside the template's organization, whose project layout is its own. */
  projectId: string | null;
  /** Withheld unless the caller may read the template it was copied from. */
  copiedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { username: string } | null;
  /** A personal organization's slug is derived from its owner's internal id, so it is withheld. */
  publisher: { name: string; slug: string | null; type: OrganizationType } | null;
  /** Null only on a template an older API pod saved without a version, until it is saved again or healed. */
  currentVersion: PublishedTemplateVersion | null;
  canEdit: boolean;
  isFavorite: boolean;
  usage: TemplateUsageSummary;
}

export interface UserTemplateListItem
  extends Pick<
    UserTemplateListRow,
    | "id"
    | "title"
    | "summary"
    | "icon"
    | "categories"
    | "visibility"
    | "isListed"
    | "moderationStatus"
    | "projectId"
    | "copiedFromId"
    | "updatedAt"
    | "currentVersion"
  > {
  lastEditedBy: { username: string } | null;
  canEdit: boolean;
  usage: Pick<TemplateUsageSummary, "deploys" | "lastDeployedAt">;
}

export type ListedTemplateVersion = TemplateVersionSummary & { deploys: number };

export type UserTemplateListQuery = { visibility?: TemplateVisibility; projectId?: string };

export const MAX_LISTED_USER_TEMPLATES = 200;

const VERSION_NOT_FOUND = "Template version not found";

function pickListedUsage({ deploys, lastDeployedAt }: TemplateUsageSummary): UserTemplateListItem["usage"] {
  return { deploys, lastDeployedAt };
}

function withoutImageDigests({ imageDigests: _imageDigests, ...version }: TemplateVersionOutput): PublishedTemplateVersion {
  return version;
}

@singleton()
export class MarketplaceTemplateService {
  constructor(
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly userTemplateRepository: UserTemplateRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly templateUsageEventRepository: TemplateUsageEventRepository
  ) {}

  async getTemplate(id: string): Promise<MarketplaceTemplateOutput> {
    const template = await this.findReadable(id);
    const currentVersion = await this.templateVersionRepository.findCurrent(id);
    const favoritingUserId = this.authService.safeCurrentUser?.userId;
    const isCopiedFromReadable = !!template.copiedFromId && !!(await this.#findReadableOrNone(template.copiedFromId));
    const usages = await this.templateUsageEventRepository.summarize([id]);

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
      projectId: isInActiveOrganization(template, this.#activeOrganizationId) ? template.projectId : null,
      copiedFromId: isCopiedFromReadable ? template.copiedFromId : null,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      author: template.authorUsername ? { username: template.authorUsername } : null,
      publisher: template.publisher && { ...template.publisher, slug: template.publisher.type === "team" ? template.publisher.slug : null },
      currentVersion: currentVersion ? this.#withLegacyFallbacks(currentVersion, template) : null,
      canEdit: this.#canEditInActiveOrganization(template),
      isFavorite: favoritingUserId ? await this.userTemplateRepository.isFavorite(id, favoritingUserId) : false,
      usage: usages.get(id) ?? NO_TEMPLATE_USAGE
    };
  }

  async listInOrganization(query: UserTemplateListQuery): Promise<UserTemplateListItem[]> {
    const ability = this.authService.ability;
    const organizationId = this.#activeOrganizationId;

    if (!organizationId || !ability.can("read", "Template")) return [];

    const rows = await this.marketplaceTemplateRepository
      .accessibleBy(ability, "read")
      .listInOrganization({ ...query, organizationId, limit: MAX_LISTED_USER_TEMPLATES });
    const usages = await this.templateUsageEventRepository.summarize(rows.map(row => row.id));

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      icon: row.icon,
      categories: row.categories,
      visibility: row.visibility,
      isListed: row.isListed,
      moderationStatus: row.moderationStatus,
      projectId: row.projectId,
      copiedFromId: row.copiedFromId,
      updatedAt: row.updatedAt,
      currentVersion: row.currentVersion,
      lastEditedBy: row.lastEditedByUsername ? { username: row.lastEditedByUsername } : null,
      canEdit: this.#canEditInActiveOrganization(row),
      usage: pickListedUsage(usages.get(row.id) ?? NO_TEMPLATE_USAGE)
    }));
  }

  /** Earlier versions may hold what the template no longer publishes, such as a removed key, so only editors see past the current one. */
  async listVersions(id: string): Promise<ListedTemplateVersion[]> {
    const template = await this.findReadable(id);
    const versions = await this.templateVersionRepository.listByTemplate(id);
    const deploysByVersion = await this.templateUsageEventRepository.countDeploysByVersion(id);
    const readableVersions = this.#hasUpdateRule(template) ? versions : versions.filter(version => version.id === template.currentVersionId);

    return readableVersions.map(version => ({ ...version, deploys: deploysByVersion.get(version.id) ?? 0 }));
  }

  async getVersion(id: string, version: number): Promise<PublishedTemplateVersion> {
    const template = await this.findReadable(id);
    const found = await this.templateVersionRepository.findByTemplateAndVersion(id, version);
    assert(found, 404, VERSION_NOT_FOUND);
    assert(found.id === template.currentVersionId || this.#hasUpdateRule(template), 404, VERSION_NOT_FOUND);

    return this.#withLegacyFallbacks(found, template);
  }

  /** Mirrors `getVersion`, so a deployment can only name a version its caller could read. */
  async findDeployableVersion(versionId: string): Promise<{ templateId: string; versionId: string }> {
    const version = await this.templateVersionRepository.findById(versionId);
    assert(version, 404, VERSION_NOT_FOUND);
    const template = await this.#findReadableOrNone(version.templateId);
    assert(template && (template.currentVersionId === version.id || this.#hasUpdateRule(template)), 404, VERSION_NOT_FOUND);

    return { templateId: template.id, versionId: version.id };
  }

  /** Answers 404 rather than 403 for a template the caller may not read, so its existence does not leak. */
  async findReadable(id: string): Promise<MarketplaceTemplateRow> {
    const template = await this.#findReadableOrNone(id);
    assert(template, 404, "Template not found");

    return template;
  }

  async #findReadableOrNone(id: string): Promise<MarketplaceTemplateRow | undefined> {
    const ability = this.authService.ability;
    const repository = ability.can("read", "Template") ? this.marketplaceTemplateRepository.accessibleBy(ability, "read") : this.marketplaceTemplateRepository;

    return await repository.findReadable(id);
  }

  get #activeOrganizationId(): string | undefined {
    return this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;
  }

  #withLegacyFallbacks(version: TemplateVersionOutput, template: MarketplaceTemplateRow): PublishedTemplateVersion {
    return {
      ...withoutImageDigests(version),
      readme: version.readme ?? (template.description || null),
      resources: version.resources ?? summarizeTemplateHardware(version.sdl) ?? null
    };
  }

  /** Uses the writer's own predicate, so the UI never offers an edit that the write would refuse. */
  #canEditInActiveOrganization(template: MarketplaceTemplateRow | UserTemplateListRow): boolean {
    return !findTemplateWriteRefusal(template, "update", { ability: this.authService.ability, activeOrganizationId: this.#activeOrganizationId });
  }

  #hasUpdateRule(template: MarketplaceTemplateRow): boolean {
    return this.authService.ability.can("update", subject("Template", { ...template }));
  }
}
