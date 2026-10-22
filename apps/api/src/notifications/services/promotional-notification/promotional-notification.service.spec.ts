import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { readProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import { PromotionalNotificationService } from "./promotional-notification.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";

const SECRET = "unsubscribe-secret";
const WEB_ORIGIN = "https://console.akash.network";
const API_ORIGIN = "https://console-api.akash.network";

describe(PromotionalNotificationService.name, () => {
  it("sends the notification with a signed unsubscribe link to the web page and the one-click endpoint", async () => {
    const { service, notificationService, notification } = setup();
    const user = createUser({ productUpdatesUnsubscribedAt: null });

    const outcome = await service.send(user, notification);

    const sent = notificationService.createNotification.mock.calls[0][0];
    const webUrl = new URL(sent.unsubscribe!.url);
    const oneClickUrl = new URL(sent.unsubscribe!.oneClickUrl);
    expect(outcome).toBe("sent");
    expect(sent).toEqual({ ...notification, unsubscribe: expect.any(Object), recipient: user.email });
    expect(`${webUrl.origin}${webUrl.pathname}`).toBe(`${WEB_ORIGIN}/unsubscribe`);
    expect(`${oneClickUrl.origin}${oneClickUrl.pathname}`).toBe(`${API_ORIGIN}/v1/product-update-unsubscriptions`);
    expect(readProductUpdateUnsubscribeToken(SECRET, webUrl.searchParams.get("token")!)).toBe(user.id);
    expect(readProductUpdateUnsubscribeToken(SECRET, oneClickUrl.searchParams.get("token")!)).toBe(user.id);
  });

  it("escapes the token so the link carries it whole", async () => {
    const { service, notificationService, notification } = setup();
    const user = createUser({ id: "user+1&2", productUpdatesUnsubscribedAt: null });

    await service.send(user, notification);

    const { unsubscribe } = notificationService.createNotification.mock.calls[0][0];
    expect(readProductUpdateUnsubscribeToken(SECRET, new URL(unsubscribe!.url).searchParams.get("token")!)).toBe(user.id);
    expect(readProductUpdateUnsubscribeToken(SECRET, new URL(unsubscribe!.oneClickUrl).searchParams.get("token")!)).toBe(user.id);
  });

  it("sends nothing to a user who opted out of product update emails", async () => {
    const { service, notificationService, notification } = setup();
    const user = createUser({ productUpdatesUnsubscribedAt: new Date() });

    const outcome = await service.send(user, notification);

    expect(outcome).toBe("unsubscribed");
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("sends nothing to a user without an email, rather than to the other addresses on their alert channel", async () => {
    const { service, notificationService, notification } = setup();
    const user = createUser({ email: null, productUpdatesUnsubscribedAt: null });

    const outcome = await service.send(user, notification);

    expect(outcome).toBe("no_email");
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("sends nothing and warns when unsubscribe links cannot be signed", async () => {
    const { service, notificationService, notification, logger } = setup({ secret: undefined });
    const user = createUser({ productUpdatesUnsubscribedAt: null });

    const outcome = await service.send(user, notification);

    expect(outcome).toBe("unsubscribe_unavailable");
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "PROMOTIONAL_EMAIL_UNSUBSCRIBE_UNAVAILABLE", userId: user.id }));
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: PromotionalNotificationService.name });
  });

  function setup(input: { secret?: string } = { secret: SECRET }) {
    const notificationService = mock<NotificationService>({ createNotification: vi.fn().mockResolvedValue(undefined) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const notification: CreateNotificationInput = {
      notificationId: `promotion.${faker.string.uuid()}`,
      payload: { summary: faker.lorem.sentence(), description: faker.lorem.paragraph() },
      user: { id: faker.string.uuid(), email: faker.internet.email() }
    };

    const service = new PromotionalNotificationService(
      notificationService,
      { EMAIL_UNSUBSCRIBE_SECRET: input.secret },
      mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL: WEB_ORIGIN }),
      mockConfigService<CoreConfigService>({ SERVER_ORIGIN: API_ORIGIN }),
      createLogger
    );

    return { service, notificationService, notification, logger, createLogger };
  }
});
