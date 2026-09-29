import escapeHtml from "lodash/escape";

import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";
import type { UserOutput } from "@src/user/repositories";

type Mailbox = { id: string; email: string };

export function hardwareRequestEmailNotification(input: {
  hardwareRequest: HardwareRequestOutput;
  requester: UserOutput | undefined;
  mailbox: Mailbox;
}): CreateNotificationInput {
  const { hardwareRequest, requester, mailbox } = input;
  const contactEmail = escapeHtml(hardwareRequest.contactEmail);

  return {
    notificationId: `hardwareRequest.${hardwareRequest.id}`,
    payload: {
      summary: subjectOf(hardwareRequest),
      description: [
        field("GPU model", hardwareRequest.gpuModel),
        field("Quantity", hardwareRequest.quantity?.toString()),
        field("Region", hardwareRequest.region),
        field("Details", hardwareRequest.details),
        field("Current configuration", hardwareRequest.configuration?.summary),
        `<p><strong>Reply to:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>`,
        field("Account email", requester?.email),
        field("Username", requester?.username),
        field("User ID", hardwareRequest.userId)
      ].join("")
    },
    user: mailbox
  };
}

function subjectOf({ category, gpuModel, quantity, region }: HardwareRequestOutput): string {
  switch (category) {
    case "gpu_model":
      return `GPU request: ${quantity}× ${gpuModel}`;
    case "capacity":
      return gpuModel ? `Capacity request: ${quantity}× ${gpuModel}` : `Capacity request: ${quantity} GPUs`;
    case "region":
      return `Region request: ${region}`;
    case "other":
      return "Hardware request";
  }
}

function field(label: string, value: string | null | undefined): string {
  if (!value) return "";

  return `<p><strong>${label}:</strong><br>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</p>`;
}
