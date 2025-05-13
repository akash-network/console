import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";

export type AlertMessage = {
  payload: AlertMessagePayload;
  contactPointId: string;
};

export type MessageCallback = (message: AlertMessage) => Promise<void>;
