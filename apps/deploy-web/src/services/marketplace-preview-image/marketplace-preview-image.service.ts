import type { LoggerService } from "@akashnetwork/logging";

import type { MarketplaceVisitorReadsService } from "@src/services/marketplace-visitor-reads/marketplace-visitor-reads.service";
import { VisitorReadCache } from "@src/services/visitor-read-cache/visitor-read-cache";
import type { PreviewImageContent } from "./preview-image-content";
import { isListedInGallery, toPublisherPreviewContent, toTemplatePreviewContent } from "./preview-image-content";

export type PreviewImage = { status: "found"; png: Buffer } | { status: "missing" } | { status: "unavailable" };

/** A drawn image is kept this long, so a link shared in a busy channel is drawn once however many crawlers ask for it. */
const IMAGE_TTL_MS = 5 * 60_000;
const MAX_KEPT_IMAGES = 200;
const FLAG_TTL_MS = 30_000;
const ONLY_ENTRY = "all";

const MISSING: PreviewImage = { status: "missing" };
const UNAVAILABLE: PreviewImage = { status: "unavailable" };

export interface MarketplacePreviewImageOptions {
  now?: () => number;
}

/** Draws the picture a shared template or publisher link shows, from the same public reads the visitor pages use and nothing the request carries. */
export class MarketplacePreviewImageService {
  readonly #reads: Pick<MarketplaceVisitorReadsService, "template" | "publisher">;
  readonly #isMarketplaceOpenToVisitors: () => Promise<boolean>;
  readonly #render: (content: PreviewImageContent) => Promise<Buffer>;
  readonly #logger: Pick<LoggerService, "warn">;
  readonly #images: VisitorReadCache<Buffer>;
  readonly #flag: VisitorReadCache<boolean>;

  constructor(
    reads: Pick<MarketplaceVisitorReadsService, "template" | "publisher">,
    isMarketplaceOpenToVisitors: () => Promise<boolean>,
    render: (content: PreviewImageContent) => Promise<Buffer>,
    logger: Pick<LoggerService, "warn">,
    options: MarketplacePreviewImageOptions = {}
  ) {
    this.#reads = reads;
    this.#isMarketplaceOpenToVisitors = isMarketplaceOpenToVisitors;
    this.#render = render;
    this.#logger = logger;
    this.#images = new VisitorReadCache({ ttlMs: IMAGE_TTL_MS, maxEntries: MAX_KEPT_IMAGES, now: options.now });
    this.#flag = new VisitorReadCache({ ttlMs: FLAG_TTL_MS, maxEntries: 1, now: options.now });
  }

  async template(id: string): Promise<PreviewImage> {
    if (!(await this.#isOpen())) return MISSING;

    const read = await this.#reads.template(id);
    if (read.status === "unavailable") return UNAVAILABLE;
    if (read.status !== "found" || !isListedInGallery(read.data.data)) return MISSING;

    return this.#draw(toTemplatePreviewContent(read.data.data));
  }

  async publisher(handle: string): Promise<PreviewImage> {
    if (!(await this.#isOpen())) return MISSING;

    const read = await this.#reads.publisher(handle);
    if (read.status === "unavailable") return UNAVAILABLE;
    if (read.status !== "found") return MISSING;

    return this.#draw(toPublisherPreviewContent(read.data.data));
  }

  async #isOpen(): Promise<boolean> {
    try {
      return await this.#flag.read(ONLY_ENTRY, this.#isMarketplaceOpenToVisitors);
    } catch (error) {
      this.#logger.warn({ event: "MARKETPLACE_PREVIEW_IMAGE_FLAG_CHECK_FAILED", error });
      return false;
    }
  }

  async #draw(content: PreviewImageContent): Promise<PreviewImage> {
    try {
      return { status: "found", png: await this.#images.read(JSON.stringify(content), () => this.#render(content)) };
    } catch (error) {
      this.#logger.warn({ event: "MARKETPLACE_PREVIEW_IMAGE_RENDER_FAILED", kind: content.kind, error });
      return UNAVAILABLE;
    }
  }
}
