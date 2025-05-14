import { faker } from "@faker-js/faker";

import type { AlertMessage } from "@src/modules/alert/types/message-callback.type";

export const generateAlertMessage = ({
  summary = faker.lorem.sentence(),
  description = faker.lorem.sentence(),
  contactPointId = faker.string.uuid()
}: Partial<Pick<AlertMessage, "contactPointId"> & AlertMessage["payload"]>): AlertMessage => {
  return {
    payload: {
      summary,
      description
    },
    contactPointId
  };
};
