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
}

export type UserTemplateListQuery = { visibility?: TemplateVisibility; projectId?: string };

export const MAX_LISTED_USER_TEMPLATES = 200;

const VERSION_NOT_FOUND = "Template version not found";

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
    private readonly executionContextService: ExecutionContextService
  ) {}

  /** Reads the version the readable row pointed at rather than the template's latest pointer, which a save that also hides the template may have moved since. */
  async getTemplate(id: string): Promise<MarketplaceTemplateOutput> {
    const template = await this.findReadable(id);
    const currentVersion = template.currentVersionId ? await this.templateVersionRepository.findById(template.currentVersionId) : undefined;
    const favoritingUserId = this.authService.safeCurrentUser?.userId;
    const isCopiedFromReadable = !!template.copiedFromId && !!(await this.#findReadableOrNone(template.copiedFromId));

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
      isFavorite: favoritingUserId ? await this.userTemplateRepository.isFavorite(id, favoritingUserId) : false
    };
  }

  async listInOrganization(query: UserTemplateListQuery): Promise<UserTemplateListItem[]> {
    const ability = this.authService.ability;
    const organizationId = this.#activeOrganizationId;

    if (!organizationId || !ability.can("read", "Template")) return [];

    const readableRepository = this.marketplaceTemplateRepository.accessibleBy(ability, "read");
    const rows = await readableRepository.listInOrganization({ ...query, organizationId, limit: MAX_LISTED_USER_TEMPLATES });
    const readableSourceIds = await readableRepository.findReadableIds([...new Set(rows.flatMap(row => row.copiedFromId ?? []))]);

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
      copiedFromId: row.copiedFromId && readableSourceIds.has(row.copiedFromId) ? row.copiedFromId : null,
      updatedAt: row.updatedAt,
      currentVersion: row.currentVersion,
      lastEditedBy: row.lastEditedByUsername ? { username: row.lastEditedByUsername } : null,
      canEdit: this.#canEditInActiveOrganization(row)
    }));
  }

  /** Earlier versions may hold what the template no longer publishes, such as a removed key, so only editors see past the current one. */
  async listVersions(id: string): Promise<TemplateVersionSummary[]> {
    const template = await this.findReadable(id);
    const versions = await this.templateVersionRepository.listByTemplate(id);

    return this.#hasUpdateRule(template) ? versions : versions.filter(version => version.id === template.currentVersionId);
  }

  async getVersion(id: string, version: number): Promise<PublishedTemplateVersion> {
    const template = await this.findReadable(id);
    const found = await this.templateVersionRepository.findByTemplateAndVersion(id, version);
    assert(found, 404, VERSION_NOT_FOUND);
    assert(found.id === template.currentVersionId || this.#hasUpdateRule(template), 404, VERSION_NOT_FOUND);

    return this.#withLegacyFallbacks(found, template);
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
