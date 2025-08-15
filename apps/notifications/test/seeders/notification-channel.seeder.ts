import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";

import type { NotificationChannelOutput } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { notificationChannelConfigSchema } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

export const generateNotificationChannel = ({
  id = faker.string.uuid(),
  name = faker.lorem.word(),
  userId = faker.string.uuid(),
  type = faker.helpers.arrayElement<NotificationChannelOutput["type"]>(["email"]),
  config = generateMock(notificationChannelConfigSchema),
  isDefault = faker.datatype.boolean(),
  createdAt = new Date(),
  updatedAt = new Date()
}: Partial<NotificationChannelOutput>): NotificationChannelOutput => {
  return {
    id,
    userId,
    name,
    type,
    config,
    createdAt,
    updatedAt,
    isDefault
  };
};
