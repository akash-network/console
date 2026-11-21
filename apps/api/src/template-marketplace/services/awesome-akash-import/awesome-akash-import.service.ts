import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { GetTemplatesListResponse } from "@src/template/http-schemas/template.schema";
import { TEMPLATE_GALLERY_SERVICE } from "@src/template/providers/template-gallery.provider";
import type { TemplateGalleryService } from "@src/template/services/template-gallery/template-gallery.service";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import {
  findImportedTemplateChanges,
  type GalleryListing,
  hasImportedTemplateChanges,
  IMPORTED_TEMPLATE_ICON,
  type ImportedTemplateContent,
  listGalleryTemplates,
  toImportedTemplate
} from "@src/template-marketplace/lib/imported-template/imported-template";
import { legacyHardwareOf } from "@src/template-marketplace/lib/legacy-mirror/legacy-version-mirror";
import { officialPublisherHandleCandidates } from "@src/template-marketplace/lib/publisher-handle/publisher-handle";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import {
  ImportedTemplateRepository,
  type ImportedTemplateUpdate,
  type NewImportedTemplate,
  type StoredImportedTemplate
} from "@src/template-marketplace/repositories/imported-template/imported-template.repository";
import {
  type PublishingOrganization,
  TemplatePublisherRepository
} from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import { TemplateSdlValidatorService } from "@src/template-marketplace/services/template-sdl-validator/template-sdl-validator.service";

export const TEMPLATE_IMPORT_OUTCOMES = ["created", "newVersions", "updated", "relisted", "skipped", "leftModerated", "failed"] as const;

export type TemplateImportOutcome = (typeof TEMPLATE_IMPORT_OUTCOMES)[number];

export type TemplateImportCounts = Record<TemplateImportOutcome | "unlisted", number>;

export type TemplateImportSkipReason = "not_configured" | "not_mainnet" | "organization_not_found" | "gallery_empty" | "gallery_unavailable";

export const IMPORTED_TEMPLATES_PER_BATCH = 25;

type ImportOwner = PublishingOrganization & { organizationId: string };

/** Mainnet and sandbox share one database and may run galleries built from different commits, which would write a version back and forth between them. */
const IMPORTING_NETWORK = "mainnet";

const SDL_TOO_LONG_ISSUE = "The SDL is too long";

function countOutcomes(outcomes: TemplateImportOutcome[], unlisted: number): TemplateImportCounts {
  const counts: TemplateImportCounts = { created: 0, newVersions: 0, updated: 0, relisted: 0, skipped: 0, leftModerated: 0, failed: 0, unlisted };

  for (const outcome of outcomes) {
    counts[outcome] += 1;
  }

  return counts;
}

type MirroredContent = Pick<NewImportedTemplate, "importedContentHash" | "sdl" | "description" | "cpu" | "ram" | "storage">;

/** The template row repeats its current version for the legacy template page, next to the hash that tells the next run nothing changed. */
function mirroredContentOf({ sdl, readme, contentHash }: ImportedTemplateContent): MirroredContent {
  return { importedContentHash: contentHash, sdl, description: readme ?? "", ...legacyHardwareOf(summarizeTemplateHardware(sdl)) };
}

function renamesOrRefiles({ title, summary, categories }: ImportedTemplateUpdate): boolean {
  return title !== undefined || summary !== undefined || categories !== undefined;
}

/** Keeps one read-only Official template per awesome-akash gallery template, owned by the configured organization, with GitHub as its source of truth. */
@singleton()
export class AwesomeAkashImportService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @inject(TEMPLATE_GALLERY_SERVICE) private readonly templateGalleryService: TemplateGalleryService,
    private readonly importedTemplateRepository: ImportedTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly templatePublisherRepository: TemplatePublisherRepository,
    private readonly templateSdlValidatorService: TemplateSdlValidatorService,
    private readonly templateImageDigestJobService: TemplateImageDigestJobService,
    private readonly txService: TxService,
    private readonly coreConfig: CoreConfigService,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: AwesomeAkashImportService.name });
  }

  /** A gallery that cannot be read or lists nothing ends the run before any write, so a broken build never unlists what was imported. */
  async run(): Promise<void> {
    const owner = await this.#findOwner();
    const listings = owner && (await this.#readGalleryListings());

    if (!owner || !listings) return;

    await this.templatePublisherRepository.findOrCreate(owner.organizationId, officialPublisherHandleCandidates(owner));
    const stored = new Map((await this.importedTemplateRepository.listAll()).map(template => [template.importedRef, template]));
    const outcomes: TemplateImportOutcome[] = [];

    for (let start = 0; start < listings.length; start += IMPORTED_TEMPLATES_PER_BATCH) {
      for (const listing of listings.slice(start, start + IMPORTED_TEMPLATES_PER_BATCH)) {
        outcomes.push(...(await this.#importSafely(listing, stored.get(listing.id), owner.organizationId)));
      }

      await yieldToEventLoop();
    }

    const unlisted = await this.importedTemplateRepository.unlist(this.#findGoneFromGallery(stored, listings));

    this.logger.info({ event: "TEMPLATES_IMPORTED", gallery: listings.length, ...countOutcomes(outcomes, unlisted) });
  }

  async #findOwner(): Promise<ImportOwner | undefined> {
    const organizationId = this.config.TEMPLATE_IMPORT_ORGANIZATION_ID;

    if (!organizationId) return this.#skipRun("not_configured");
    if (this.coreConfig.get("NETWORK") !== IMPORTING_NETWORK) return this.#skipRun("not_mainnet");

    const organization = await this.importedTemplateRepository.findOwningOrganization(organizationId);

    return organization ? { ...organization, organizationId } : this.#skipRun("organization_not_found", organizationId);
  }

  #skipRun(reason: TemplateImportSkipReason, organizationId?: string): undefined {
    this.logger.info({ event: "TEMPLATE_IMPORT_SKIPPED", reason, ...(organizationId && { organizationId }) });

    return undefined;
  }

  async #readGalleryListings(): Promise<GalleryListing[] | undefined> {
    try {
      const gallery: GetTemplatesListResponse = JSON.parse((await this.templateGalleryService.getGallerySummaryBuffer()).toString("utf8"));
      const listings = listGalleryTemplates(gallery.data);

      return listings.length > 0 ? listings : this.#skipRun("gallery_empty");
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_IMPORT_SKIPPED", reason: "gallery_unavailable" satisfies TemplateImportSkipReason, error });

      return undefined;
    }
  }

  #findGoneFromGallery(stored: Map<string, StoredImportedTemplate>, listings: GalleryListing[]): string[] {
    const listedRefs = new Set(listings.map(listing => listing.id));

    return [...stored.values()].filter(template => !listedRefs.has(template.importedRef) && template.isListed).map(template => template.id);
  }

  async #importSafely(listing: GalleryListing, stored: StoredImportedTemplate | undefined, organizationId: string): Promise<TemplateImportOutcome[]> {
    try {
      return await this.#import(listing, stored, organizationId);
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_IMPORT_TEMPLATE_FAILED", importedRef: listing.id, error });

      return ["failed"];
    }
  }

  async #import(listing: GalleryListing, stored: StoredImportedTemplate | undefined, organizationId: string): Promise<TemplateImportOutcome[]> {
    if (stored && stored.moderationStatus !== "active") return ["leftModerated"];

    const template = await this.templateGalleryService.getTemplateById(listing.id);

    if (!template) return this.#skip(listing.id, ["The gallery holds no content for this template"]);

    const next = toImportedTemplate(template, listing.categories);

    if (!stored) return await this.#create(next, organizationId);

    return hasImportedTemplateChanges(findImportedTemplateChanges(stored, next)) ? await this.#update(stored.id, next) : [];
  }

  /** A gallery id another run holds by now creates nothing here, and that run's template is brought up to date by the next one. */
  async #create(next: ImportedTemplateContent, organizationId: string): Promise<TemplateImportOutcome[]> {
    const issues = this.#findSdlIssues(next.sdl);

    if (issues.length > 0) return this.#skip(next.importedRef, issues);

    return await this.txService.transaction(async () => {
      const id = await this.importedTemplateRepository.create({
        organizationId,
        importedRef: next.importedRef,
        title: next.title,
        summary: next.summary,
        icon: IMPORTED_TEMPLATE_ICON,
        categories: next.categories,
        ...mirroredContentOf(next)
      });

      if (!id) return [];

      await this.#appendVersion(id, next);

      return ["created"];
    });
  }

  /** Judged again on the locked row, which another run may have brought up to date or staff may have hidden since it was listed. */
  async #update(id: string, next: ImportedTemplateContent): Promise<TemplateImportOutcome[]> {
    return await this.txService.transaction(async () => {
      const locked = await this.importedTemplateRepository.findAndLock(id);

      if (locked?.moderationStatus !== "active") return ["leftModerated"];

      const { settings, hasNewContent } = findImportedTemplateChanges(locked, next);
      const issues = hasNewContent ? this.#findSdlIssues(next.sdl) : [];
      const writesVersion = hasNewContent && issues.length === 0;
      const update: ImportedTemplateUpdate = { ...settings, ...(writesVersion && (await this.#appendVersion(id, next))) };

      if (Object.keys(update).length > 0) await this.importedTemplateRepository.update(id, update);

      return [
        ...(writesVersion ? (["newVersions"] as const) : []),
        ...(issues.length > 0 ? this.#skip(next.importedRef, issues) : []),
        ...(renamesOrRefiles(settings) ? (["updated"] as const) : []),
        ...(settings.isListed ? (["relisted"] as const) : [])
      ];
    });
  }

  /** Saved live without the publish gate, since the gallery is reviewed upstream, with the resources and image digests any version shows. */
  async #appendVersion(templateId: string, next: ImportedTemplateContent): Promise<MirroredContent> {
    const version = await this.templateVersionRepository.appendVersion({
      templateId,
      sdl: next.sdl,
      readme: next.readme,
      askedValues: [],
      resources: summarizeTemplateHardware(next.sdl) ?? null
    });
    await this.templateImageDigestJobService.schedule(version.id);

    return mirroredContentOf(next);
  }

  #findSdlIssues(sdl: string): string[] {
    return sdl.length > SDL_MAX_LENGTH ? [SDL_TOO_LONG_ISSUE] : this.templateSdlValidatorService.findIssues(sdl);
  }

  #skip(importedRef: string, issues: string[]): TemplateImportOutcome[] {
    this.logger.warn({ event: "TEMPLATE_IMPORT_TEMPLATE_SKIPPED", importedRef, issues });

    return ["skipped"];
  }
}
