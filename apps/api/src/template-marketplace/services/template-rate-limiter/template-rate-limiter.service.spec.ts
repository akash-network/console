import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { envSchema } from "@src/template-marketplace/config/env.config";
import type {
  RateLimitedTemplateAction,
  RateLimitScope,
  TemplateRateLimitRepository
} from "@src/template-marketplace/repositories/template-rate-limit/template-rate-limit.repository";
import type { UserRepository } from "@src/user/repositories";
import { TemplateRateLimiterService } from "./template-rate-limiter.service";

const CONFIG = envSchema.parse({
  TEMPLATE_CREATE_LIMIT_PER_USER: "11",
  TEMPLATE_CREATE_LIMIT_PER_ORGANIZATION: "12",
  TEMPLATE_CREATE_LIMIT_WINDOW_SECONDS: "3600",
  TEMPLATE_VERSION_LIMIT_PER_USER: "21",
  TEMPLATE_VERSION_LIMIT_PER_ORGANIZATION: "22",
  TEMPLATE_VERSION_LIMIT_WINDOW_SECONDS: "7200",
  TEMPLATE_PUBLISH_LIMIT_PER_USER: "31",
  TEMPLATE_PUBLISH_LIMIT_PER_ORGANIZATION: "32",
  TEMPLATE_PUBLISH_LIMIT_WINDOW_SECONDS: "86400"
});

describe(TemplateRateLimiterService.name, () => {
  it.each<{ action: RateLimitedTemplateAction; perUser: object; perOrganization: object }>([
    {
      action: "create",
      perUser: { counted: "new templates", scope: "user", max: 11, windowSeconds: 3600 },
      perOrganization: { counted: "new templates", scope: "organization", max: 12, windowSeconds: 3600 }
    },
    {
      action: "version",
      perUser: { counted: "saved versions", scope: "user", max: 21, windowSeconds: 7200 },
      perOrganization: { counted: "saved versions", scope: "organization", max: 22, windowSeconds: 7200 }
    },
    {
      action: "publish",
      perUser: { counted: "published templates", scope: "user", max: 31, windowSeconds: 86400 },
      perOrganization: { counted: "published templates", scope: "organization", max: 32, windowSeconds: 86400 }
    }
  ])("lets a $action through under the configured limits of the user and the organization", async ({ action, perUser, perOrganization }) => {
    const { service, actor, templateRateLimitRepository } = setup();

    await expect(service.assertWithinLimits(action, actor)).resolves.toBeUndefined();

    expect(templateRateLimitRepository.findSecondsUntilRoom.mock.calls).toEqual([
      [action, { userId: actor.userId }, perUser],
      [action, { organizationId: actor.organizationId }, perOrganization]
    ]);
  });

  it("locks the organization, then the user, before counting", async () => {
    const { service, actor, steps } = setup();

    await service.assertWithinLimits("create", actor);

    expect(steps).toEqual([`lock organization ${actor.organizationId}`, `lock user ${actor.userId}`, "count", "count"]);
  });

  it("refuses with the user's limit when only the user is over it", async () => {
    const { service, actor } = setup({ secondsUntilRoom: { user: 700 } });

    await expect(service.assertWithinLimits("create", actor)).rejects.toMatchObject({
      status: 429,
      message: "You reached the limit of 11 new templates per hour. Try again in 12 minutes.",
      errorCode: "template_rate_limited",
      headers: { "Retry-After": "700" },
      data: { action: "create", scope: "user", limit: 11, windowSeconds: 3600, retryAfterSeconds: 700 }
    });
  });

  it("refuses with the organization's limit when only the organization is over it", async () => {
    const { service, actor } = setup({ secondsUntilRoom: { organization: 90 } });

    await expect(service.assertWithinLimits("version", actor)).rejects.toMatchObject({
      status: 429,
      message: "Your organization reached the limit of 22 saved versions per 2 hours. Try again in 2 minutes.",
      headers: { "Retry-After": "90" },
      data: { action: "version", scope: "organization", limit: 22 }
    });
  });

  it("names the limit that lifts last when both are reached", async () => {
    const { service, actor } = setup({ secondsUntilRoom: { user: 60, organization: 3600 } });

    await expect(service.assertWithinLimits("publish", actor)).rejects.toMatchObject({
      message: "Your organization reached the limit of 32 published templates per day. Try again in 1 hour.",
      headers: { "Retry-After": "3600" }
    });
  });

  function setup(input: { secondsUntilRoom?: { user?: number; organization?: number } } = {}) {
    const actor = { userId: faker.string.uuid(), organizationId: faker.string.uuid() };
    const steps: string[] = [];
    const templateRateLimitRepository = mock<TemplateRateLimitRepository>();
    templateRateLimitRepository.findSecondsUntilRoom.mockImplementation(async (_action, scope: RateLimitScope) => {
      steps.push("count");
      return "userId" in scope ? input.secondsUntilRoom?.user : input.secondsUntilRoom?.organization;
    });
    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findOneByAndLock.mockImplementation(async query => {
      steps.push(`lock organization ${query?.id}`);
      return undefined;
    });
    const userRepository = mock<UserRepository>();
    userRepository.findOneByAndLock.mockImplementation(async query => {
      steps.push(`lock user ${query?.id}`);
      return undefined;
    });
    const service = new TemplateRateLimiterService(templateRateLimitRepository, organizationRepository, userRepository, CONFIG);

    return { service, actor, steps, templateRateLimitRepository, organizationRepository, userRepository };
  }
});
