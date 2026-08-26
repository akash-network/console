import type { AlertMessagePayload } from "@src/modules/alert/services/alert-message/alert-message.service";

export type AlertMessage = {
  payload: AlertMessagePayload;
  notificationChannelId: string;
  /** Absent on chain-alert messages and on jobs enqueued before this field existed. */
  notificationId?: string;
};

export type MessageCallback = (message: AlertMessage) => Promise<void>;
