import { faker } from '@faker-js/faker';

import type { NotificationParams } from '@src/event-routing/services/event-matching/event-matching.service';

/**
 * Generates a mock notification parameter object
 */
export function generateMockNotificationParams(
  options: {
    userId?: string;
    email?: string;
    payload?: Record<string, unknown>;
  } = {},
): NotificationParams {
  return {
    channel: {
      type: 'email',
      address: options.email || faker.internet.email(),
    },
    userId: options.userId || faker.string.uuid(),
    payload: JSON.stringify(
      options.payload || {
        deploymentId: faker.string.numeric(6),
        owner: faker.finance.ethereumAddress(),
        timestamp: faker.date.recent().toISOString(),
      },
    ),
  };
}

/**
 * Generates an array of mock notification parameters
 */
export function generateMockNotificationsParams(
  count: number = 2,
  options: {
    userId?: string;
    email?: string;
    payload?: Record<string, unknown>;
  } = {},
): NotificationParams[] {
  return Array.from({ length: count }, () =>
    generateMockNotificationParams(options),
  );
}
