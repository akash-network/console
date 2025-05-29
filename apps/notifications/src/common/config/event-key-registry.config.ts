import { MsgCloseDeployment } from "@akashnetwork/akash-api/v1beta3";

export const eventKeyRegistry = Object.freeze({
  blockCreated: "blockchain.v1.block.created",
  msgCloseDeployment: MsgCloseDeployment["$type"],
  createNotification: "notifications.v1.notification.create"
});
