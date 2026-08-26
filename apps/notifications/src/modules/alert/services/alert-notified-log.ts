type NotifiedAlert = {
  id: string;
  type: string;
  name: string;
  userId: string;
  notificationChannelId: string;
};

type NotifiedContext = {
  status?: string;
  reason?: string;
  triggerType?: string;
};

type AlertNotifiedLog = NotifiedContext & {
  event: "ALERT_NOTIFIED";
  alertId: string;
  alertType: string;
  alertName: string;
  userId: string;
  notificationChannelId: string;
};

/** Keeps every ALERT_NOTIFIED record on the same field names so Loki can aggregate across alert types. */
export function alertNotifiedLog(alert: NotifiedAlert, context: NotifiedContext = {}): AlertNotifiedLog {
  return {
    event: "ALERT_NOTIFIED",
    alertId: alert.id,
    alertType: alert.type,
    alertName: alert.name,
    userId: alert.userId,
    notificationChannelId: alert.notificationChannelId,
    ...context
  };
}
