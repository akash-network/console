import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationDataResolvers } from "@src/notifications/providers/notification-data-resolvers.provider";
import type { UserOutput } from "@src/user/repositories";
import { NotificationDataResolverService, RESOLVED_MARKER } from "./notification-data-resolver.service";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(NotificationDataResolverService.name, () => {
  it("returns undefined when vars is undefined", async () => {
    const { service } = setup();

    const result = await service.resolve(faker.string.uuid() as unknown as UserOutput, undefined);

    expect(result).toBeUndefined();
  });

  it("resolves mixed resolved and unresolved values", async () => {
    const remainingCredits = faker.number.int({ min: 1000, max: 10000 });
    const activeDeployments = faker.number.int({ min: 0, max: 10 });
    const resolvers = {
      remainingCredits: { resolve: jest.fn().mockResolvedValue(remainingCredits) },
      activeDeployments: { resolve: jest.fn().mockResolvedValue(activeDeployments) }
    };
    const { service } = setup({ resolvers });
    const user = UserSeeder.create();
    const vars = {
      paymentLink: faker.internet.url(),
      trialEndsAt: "2023-11-13T12:00:00Z",
      remainingCredits: RESOLVED_MARKER,
      activeDeployments: RESOLVED_MARKER,
      deploymentLifetimeInHours: 24
    };

    const result = await service.resolve(user, vars);

    expect(resolvers.remainingCredits.resolve).toHaveBeenCalledWith(user);
    expect(resolvers.activeDeployments.resolve).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      paymentLink: vars.paymentLink,
      trialEndsAt: vars.trialEndsAt,
      remainingCredits,
      activeDeployments,
      deploymentLifetimeInHours: vars.deploymentLifetimeInHours
    });
  });

  it("logs error and skips resolution for unknown resolver", async () => {
    const { service, logger } = setup();
    const user = UserSeeder.create();
    const vars = {
      paymentLink: faker.internet.url(),
      unknownField: RESOLVED_MARKER
    };

    const result = await service.resolve(user, vars);

    expect(logger.error).toHaveBeenCalledWith({
      event: "UNKNOWN_NOTIFICATION_RESOLVER",
      key: "unknownField"
    });
    expect(result).toEqual({
      paymentLink: vars.paymentLink
    });
  });

  it("handles resolver that returns undefined", async () => {
    const resolver = jest.fn().mockResolvedValue(undefined);
    const { service } = setup({
      resolvers: {
        optionalField: { resolve: resolver }
      }
    });
    const user = UserSeeder.create();
    const vars = {
      paymentLink: faker.internet.url(),
      optionalField: RESOLVED_MARKER
    };

    const result = await service.resolve(user, vars);

    expect(resolver).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      paymentLink: vars.paymentLink,
      optionalField: undefined
    });
  });

  it("handles resolver that throws error", async () => {
    const error = new Error("Resolver failed");
    const resolver = jest.fn().mockRejectedValue(error);
    const { service } = setup({
      resolvers: {
        failingField: { resolve: resolver }
      }
    });
    const user = UserSeeder.create();
    const vars = {
      paymentLink: faker.internet.url(),
      failingField: RESOLVED_MARKER
    };

    await expect(service.resolve(user, vars)).rejects.toThrow("Resolver failed");
    expect(resolver).toHaveBeenCalledWith(user);
  });

  function setup(input?: { resolvers?: Record<string, { resolve: jest.Mock }> }) {
    const mocks = {
      resolvers: mock<NotificationDataResolvers>(input?.resolvers ?? {}),
      logger: mock<LoggerService>()
    };

    const service = new NotificationDataResolverService(mocks.resolvers, mocks.logger);

    return { service, ...mocks };
  }
});
