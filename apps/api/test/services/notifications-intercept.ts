import nock from "nock";
import { container } from "tsyringe";

import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

export interface SentNotification {
  userId: string | undefined;
  body: Record<string, unknown>;
}

/** Replies 204 because that is the only status the internal endpoint declares. */
export function interceptNotifications() {
  const sent: SentNotification[] = [];

  nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
    .persist()
    .post(NOTIFICATION_PATH)
    .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
      sent.push({ userId: this.req.headers["x-user-id"] as string, body: body as Record<string, unknown> });

      return [204];
    });

  return () => sent;
}
