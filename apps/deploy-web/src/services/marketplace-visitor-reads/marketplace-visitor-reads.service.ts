import type { TemplateCategory, TemplateHttpService } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { isApiError } from "@akashnetwork/openapi-sdk";

import { readRemovedTemplate } from "@src/components/templates/removed/readRemovedTemplate";
import type { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { VisitorReadCache } from "@src/services/visitor-read-cache/visitor-read-cache";

type PublicApi = ReturnType<typeof createApiSdk>;

export type VisitorTemplateResponse = Awaited<ReturnType<PublicApi["v1"]["getUserTemplate"]>>;
export type VisitorPublisherResponse = Awaited<ReturnType<PublicApi["v1"]["getTemplatePublisher"]>>;
export type VisitorCommunityGalleryResponse = Awaited<ReturnType<PublicApi["v1"]["listCommunityTemplates"]>>;

export type VisitorRead<T> =
  | { status: "found"; data: T }
  | { status: "missing" }
  | { status: "removed"; title: string | undefined }
  | { status: "unavailable" };

/** A page that waits longer than this for the API is sent without its data, and the browser loads it instead. */
export const VISITOR_READ_TIMEOUT_MS = 2_500;

/** A template taken down by staff stops being served to visitors within this long. */
const TEMPLATE_TTL_MS = 30_000;
const LISTING_TTL_MS = 60_000;
const AWESOME_AKASH_TTL_MS = 5 * 60_000;
const MAX_CACHED_PAGES = 500;

const TEMPLATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLISHER_HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_PUBLISHER_HANDLE_LENGTH = 64;

const ONLY_ENTRY = "all";

/** A private, hidden or unknown template and an unknown or suspended publisher answer 404, an address none can have 400. */
const MISSING_STATUSES = [400, 404];

export interface MarketplaceVisitorReadsOptions {
  timeoutMs?: number;
  now?: () => number;
}

/**
 * Reads the marketplace as a visitor with no session sees it, for server renders and preview images.
 * It is built on a client that carries no cookie, token or organization of the request, because every answer is kept and served to the next visitor.
 */
export class MarketplaceVisitorReadsService {
  readonly #api: PublicApi;
  readonly #templateService: Pick<TemplateHttpService, "findGroupedByCategory">;
  readonly #logger: Pick<LoggerService, "warn">;
  readonly #timeoutMs: number;
  readonly #templates: VisitorReadCache<VisitorTemplateResponse>;
  readonly #publishers: VisitorReadCache<VisitorPublisherResponse>;
  readonly #communityGallery: VisitorReadCache<VisitorCommunityGalleryResponse>;
  readonly #awesomeAkashCategories: VisitorReadCache<TemplateCategory[]>;

  constructor(
    api: PublicApi,
    templateService: Pick<TemplateHttpService, "findGroupedByCategory">,
    logger: Pick<LoggerService, "warn">,
    options: MarketplaceVisitorReadsOptions = {}
  ) {
    this.#api = api;
    this.#templateService = templateService;
    this.#logger = logger;
    this.#timeoutMs = options.timeoutMs ?? VISITOR_READ_TIMEOUT_MS;
    this.#templates = new VisitorReadCache({ ttlMs: TEMPLATE_TTL_MS, maxEntries: MAX_CACHED_PAGES, now: options.now });
    this.#publishers = new VisitorReadCache({ ttlMs: LISTING_TTL_MS, maxEntries: MAX_CACHED_PAGES, now: options.now });
    this.#communityGallery = new VisitorReadCache({ ttlMs: LISTING_TTL_MS, maxEntries: 1, now: options.now });
    this.#awesomeAkashCategories = new VisitorReadCache({ ttlMs: AWESOME_AKASH_TTL_MS, maxEntries: 1, now: options.now });
  }

  async template(id: string): Promise<VisitorRead<VisitorTemplateResponse>> {
    if (!TEMPLATE_ID.test(id)) return { status: "missing" };

    const templateId = id.toLowerCase();
    return this.#settle("template", () => this.#templates.read(templateId, () => this.#api.v1.getUserTemplate({ id: templateId })));
  }

  async publisher(handle: string): Promise<VisitorRead<VisitorPublisherResponse>> {
    if (handle.length > MAX_PUBLISHER_HANDLE_LENGTH || !PUBLISHER_HANDLE.test(handle)) return { status: "missing" };

    return this.#settle("publisher", () => this.#publishers.read(handle, () => this.#api.v1.getTemplatePublisher({ handle })));
  }

  communityGallery(): Promise<VisitorRead<VisitorCommunityGalleryResponse>> {
    return this.#settle("community_gallery", () => this.#communityGallery.read(ONLY_ENTRY, () => this.#api.v1.listCommunityTemplates()));
  }

  awesomeAkashCategories(): Promise<VisitorRead<TemplateCategory[]>> {
    return this.#settle("awesome_akash", () =>
      this.#awesomeAkashCategories.read(ONLY_ENTRY, async () => (await this.#templateService.findGroupedByCategory()).data)
    );
  }

  async #settle<T>(read: string, load: () => Promise<T>): Promise<VisitorRead<T>> {
    try {
      return { status: "found", data: await this.#withinTimeout(load()) };
    } catch (error) {
      const removed = readRemovedTemplate(error);
      if (removed) return { status: "removed", title: removed.title };
      if (isApiError(error) && MISSING_STATUSES.includes(error.status)) return { status: "missing" };

      this.#logger.warn({ event: "MARKETPLACE_VISITOR_READ_FAILED", read, error });
      return { status: "unavailable" };
    }
  }

  #withinTimeout<T>(read: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new VisitorReadTimeoutError(this.#timeoutMs)), this.#timeoutMs);
    });

    return Promise.race([read, timeout]).finally(() => clearTimeout(timer));
  }
}

export class VisitorReadTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The API did not answer within ${timeoutMs} ms`);
    this.name = "VisitorReadTimeoutError";
  }
}
