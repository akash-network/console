import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { readSdlServiceImages } from "@src/template-marketplace/lib/sdl-images/read-sdl-service-images";
import { MarketplaceTemplateRepository } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import { TemplateImageChangeRepository } from "@src/template-marketplace/repositories/template-image-change/template-image-change.repository";
import { type TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { type ImageDigestResolution, ImageRegistryClient } from "@src/template-marketplace/services/image-registry-client/image-registry.client";
import { ResolveTemplateVersionImageDigests } from "./resolve-template-version-image-digests.job";

/** Keeps one job inside the queue's expiry even when every registry it asks times out. */
export const MAX_RESOLVED_IMAGES_PER_VERSION = 16;

type ImageResolution = { image: string; resolution: ImageDigestResolution };

type ResolvedImage = { image: string; digest: string };

/** Records the digest behind each image of a version, and files an image change when a digest recorded earlier is no longer the one a public template's current version pulls. */
@singleton()
export class ResolveTemplateVersionImageDigestsHandler implements JobHandler<ResolveTemplateVersionImageDigests> {
  public readonly accepts = ResolveTemplateVersionImageDigests;

  /** With the per-version singletonKey, keeps a version saved and watched at once from being resolved twice at once. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateImageChangeRepository: TemplateImageChangeRepository,
    private readonly imageRegistryClient: ImageRegistryClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ResolveTemplateVersionImageDigestsHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ versionId }: JobPayload<ResolveTemplateVersionImageDigests>, job?: JobMeta): Promise<void> {
    const version = await this.templateVersionRepository.findById(versionId);

    if (!version) {
      this.logger.info({ event: "TEMPLATE_IMAGE_DIGESTS_SKIPPED", reason: "VERSION_NOT_FOUND", versionId });
      return;
    }

    const resolutions = await this.#resolveImagesOf(version);
    const resolved = resolutions.flatMap(({ image, resolution }) => (resolution.status === "resolved" ? [{ image, digest: resolution.digest }] : []));

    await this.#recordNewDigests(version, resolved);
    await this.#recordMovedDigests(version, resolved);
    this.#giveUpOrRetry(versionId, resolutions, job);
  }

  async #resolveImagesOf(version: TemplateVersionOutput): Promise<ImageResolution[]> {
    const images = [...new Set(readSdlServiceImages(version.sdl).map(({ image }) => image))].slice(0, MAX_RESOLVED_IMAGES_PER_VERSION);
    const resolutions: ImageResolution[] = [];

    for (const image of images) {
      resolutions.push({ image, resolution: await this.imageRegistryClient.resolveDigest(image) });
    }

    return resolutions;
  }

  async #recordNewDigests(version: TemplateVersionOutput, resolved: ResolvedImage[]): Promise<void> {
    const newDigests = resolved.filter(({ image }) => version.imageDigests[image] === undefined);

    if (newDigests.length === 0) return;

    await this.templateVersionRepository.recordImageDigests(version.id, Object.fromEntries(newDigests.map(({ image, digest }) => [image, digest])));
  }

  /** Only the version people deploy today from a template anyone may read is worth staff time; an earlier or unpublished version moving harms nobody new. */
  async #recordMovedDigests(version: TemplateVersionOutput, resolved: ResolvedImage[]): Promise<void> {
    const moved = resolved.filter(({ image, digest }) => version.imageDigests[image] !== undefined && version.imageDigests[image] !== digest);

    if (moved.length === 0) return;

    const template = await this.marketplaceTemplateRepository.findPubliclyReadable(version.templateId);

    if (template?.currentVersionId !== version.id) return;

    for (const { image, digest } of moved) {
      const change = { templateId: template.id, templateVersionId: version.id, image, oldDigest: version.imageDigests[image], newDigest: digest };

      if (await this.templateImageChangeRepository.recordOpen(change)) {
        this.logger.warn({ event: "TEMPLATE_IMAGE_CHANGE_DETECTED", ...change });
      }
    }
  }

  /** A registry that is down is asked again by the queue's retries; once they run out the image stays without a digest, as one that cannot be resolved at all does from the start. */
  #giveUpOrRetry(versionId: string, resolutions: ImageResolution[], job: JobMeta | undefined): void {
    const unavailable = resolutions.filter(({ resolution }) => resolution.status === "unavailable");

    if (unavailable.length > 0 && job && job.retryCount < job.retryLimit) {
      throw new Error(`Could not reach the registry of ${unavailable.length} image(s) of template version ${versionId}`);
    }

    for (const { image, resolution } of resolutions) {
      if (resolution.status === "resolved") continue;

      this.logger.warn({ event: "TEMPLATE_IMAGE_DIGEST_UNRESOLVED", versionId, image, status: resolution.status, reason: resolution.reason });
    }
  }
}
