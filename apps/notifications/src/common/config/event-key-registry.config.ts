export const eventKeyRegistry = {
  blockCreated: "blockchain.v1.block.created",
  eventCloseDeployment: "akash.v1.deployment.deployment-closed",
  eventLeaseReclaimStarted: "akash.v1.market.lease-reclaim-started",
  eventLeaseClosed: "akash.v1.market.lease-closed",
  createNotification: "notifications.v1.notification.create",
  closureAlertsDue: "notifications.v1.closure-alerts.due",
  addFeedEntries: "notifications.v1.feed-entries.add"
} as const;
