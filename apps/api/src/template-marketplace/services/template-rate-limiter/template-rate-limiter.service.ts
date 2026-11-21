import { singleton } from "tsyringe";

import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { createRateLimitError, findLastingRefusal, type RateLimitRefusal } from "@src/template-marketplace/lib/rate-limit/rate-limit-error";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import {
  type RateLimitedTemplateAction,
  type RateLimitScope,
  type SlidingWindowLimit,
  TemplateRateLimitRepository
} from "@src/template-marketplace/repositories/template-rate-limit/template-rate-limit.repository";
import { UserRepository } from "@src/user/repositories";

export type RateLimitedActor = { userId: string; organizationId: string };

type ActionLimits = { counted: string; perUser: SlidingWindowLimit; perOrganization: SlidingWindowLimit };

@singleton()
export class TemplateRateLimiterService {
  constructor(
    private readonly templateRateLimitRepository: TemplateRateLimitRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig
  ) {}

  /** Call it inside the transaction that writes the counted row; it locks the organization row, then the user row, so parallel requests cannot all fit under one count. */
  async assertWithinLimits(action: RateLimitedTemplateAction, { userId, organizationId }: RateLimitedActor): Promise<void> {
    await this.organizationRepository.findOneByAndLock({ id: organizationId }, { strength: "no key update" });
    await this.userRepository.findOneByAndLock({ id: userId }, { strength: "no key update" });
    const { counted, perUser, perOrganization } = this.#limitsOf(action);
    const refusals = [
      await this.#findRefusal(action, { userId }, { counted, scope: "user", ...perUser }),
      await this.#findRefusal(action, { organizationId }, { counted, scope: "organization", ...perOrganization })
    ].filter(refusal => refusal !== undefined);
    const lasting = findLastingRefusal(refusals);

    if (lasting) throw createRateLimitError(action, lasting);
  }

  async #findRefusal(
    action: RateLimitedTemplateAction,
    scope: RateLimitScope,
    limit: Omit<RateLimitRefusal, "retryAfterSeconds">
  ): Promise<RateLimitRefusal | undefined> {
    const retryAfterSeconds = await this.templateRateLimitRepository.findSecondsUntilRoom(action, scope, limit);

    return retryAfterSeconds === undefined ? undefined : { ...limit, retryAfterSeconds };
  }

  #limitsOf(action: RateLimitedTemplateAction): ActionLimits {
    const config = this.config;

    return {
      create: {
        counted: "new templates",
        perUser: { max: config.TEMPLATE_CREATE_LIMIT_PER_USER, windowSeconds: config.TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS },
        perOrganization: { max: config.TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION, windowSeconds: config.TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS }
      },
      version: {
        counted: "saved versions",
        perUser: { max: config.TEMPLATE_VERSION_LIMIT_PER_USER, windowSeconds: config.TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS },
        perOrganization: { max: config.TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION, windowSeconds: config.TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS }
      },
      publish: {
        counted: "published templates",
        perUser: { max: config.TEMPLATE_PUBLISH_LIMIT_PER_USER, windowSeconds: config.TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS },
        perOrganization: { max: config.TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION, windowSeconds: config.TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS }
      }
    }[action];
  }
}
