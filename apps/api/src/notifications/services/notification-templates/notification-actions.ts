import type { CreateNotificationInput } from "../notification/notification.service";

type NotificationAction = NonNullable<CreateNotificationInput["payload"]["actions"]>[number];

/** Jobs enqueued before a link var existed omit it, and the notifications API rejects an action with no url by dropping the whole email. */
export function linkedActions(...actions: Array<{ label: string; url: string | undefined }>): NotificationAction[] | undefined {
  const linked = actions.filter((action): action is NotificationAction => !!action.url);
  return linked.length > 0 ? linked : undefined;
}
