import { faker } from "@faker-js/faker";

import type { AlertMessage } from "@src/modules/alert/types/message-callback.type";

export const generateAlertMessage = ({
  summary = faker.lorem.sentence(),
  description = faker.lorem.sentence(),
  notificationChannelId = faker.string.uuid()
}: Partial<Pick<AlertMessage, "notificationChannelId"> & AlertMessage["payload"]>): AlertMessage => {
  return {
    payload: {
      summary,
      description
    },
    notificationChannelId
  };
};
