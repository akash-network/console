import escapeHtml from "lodash/escape";

import {
  describeAccount,
  describeLane,
  type HardwareRequestAlertContext,
  salesOwnerOf
} from "@src/hardware-request/lib/hardware-request-alert-summary/hardware-request-alert-summary";
import { describeSpec } from "@src/hardware-request/lib/hardware-request-spec-summary/hardware-request-spec-summary";
import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";
import type { UserOutput } from "@src/user/repositories";

type Mailbox = { id: string; email: string };

export function hardwareRequestEmailNotification(input: {
  hardwareRequest: HardwareRequestOutput;
  requester: UserOutput | undefined;
  context: HardwareRequestAlertContext;
  mailbox: Mailbox;
  notificationId?: string;
}): CreateNotificationInput {
  const { hardwareRequest, requester, context, mailbox } = input;
  const owner = salesOwnerOf(hardwareRequest, context);
  const contactEmail = escapeHtml(hardwareRequest.contactEmail);

  return {
    notificationId: input.notificationId ?? `hardwareRequest.${hardwareRequest.id}`,
    payload: {
      summary: hardwareRequestTitle(hardwareRequest),
      description: [
        field("Lane", describeLane(hardwareRequest)),
        field("Owner", owner?.name),
        field("Account", describeAccount(hardwareRequest, context)),
        field("GPU model", hardwareRequest.gpuModel),
        field("Quantity", hardwareRequest.quantity?.toString()),
        field("Region", hardwareRequest.region),
        field("Request", hardwareRequest.spec && describeSpec(hardwareRequest.spec).join("\n")),
        field("Details", hardwareRequest.details),
        field("Sent while configuring", hardwareRequest.configuration?.summary),
        `<p><strong>Reply to:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>`,
        field("Account email", requester?.email),
        field("Username", requester?.username),
        field("User ID", hardwareRequest.userId)
      ].join("")
    },
    user: mailbox
  };
}

function field(label: string, value: string | null | undefined): string {
  if (!value) return "";

  return `<p><strong>${label}:</strong><br>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</p>`;
}
