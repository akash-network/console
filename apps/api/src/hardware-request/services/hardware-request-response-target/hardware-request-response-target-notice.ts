import escapeHtml from "lodash/escape";

import type { SalesOwner } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { ResponseTarget } from "@src/hardware-request/lib/hardware-request-response-schedule/hardware-request-response-schedule";
import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";

export type ResponseTargetStage = "reminder" | "escalation";

export type ResponseTargetNoticeInput = {
  hardwareRequest: HardwareRequestOutput;
  target: ResponseTarget;
  stage: ResponseTargetStage;
  dueLabel: string;
};

const TARGET_LABELS: Record<ResponseTarget, string> = { first_reply: "first reply", first_offer: "first offer" };

/** Keyed on the request, target and stage, so a retried job emails once. */
export function responseTargetEmail(input: ResponseTargetNoticeInput & { recipient: { id: string; email: string } }): CreateNotificationInput {
  const { hardwareRequest, target, stage, dueLabel, recipient } = input;
  const label = TARGET_LABELS[target];
  const contactEmail = escapeHtml(hardwareRequest.contactEmail);

  return {
    notificationId: `hardwareRequestResponseTarget.${hardwareRequest.id}.${target}.${stage}`,
    payload: {
      summary: `${stage === "reminder" ? `The ${label} is due soon` : `The ${label} target was missed`}: ${hardwareRequestTitle(hardwareRequest)}`,
      description: [
        `<p>The ${label} on this request ${stage === "reminder" ? "is" : "was"} due by ${escapeHtml(dueLabel)}.</p>`,
        `<p><strong>Request ID:</strong><br>${escapeHtml(hardwareRequest.id)}</p>`,
        `<p><strong>Contact:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></p>`
      ].join("")
    },
    user: recipient
  };
}

export function responseTargetEscalationSlackText(input: ResponseTargetNoticeInput & { lead?: SalesOwner; owner?: SalesOwner }): string {
  const { hardwareRequest, target, dueLabel, lead, owner } = input;
  const mentions = [lead, owner].flatMap(person => (person ? [person.slackUserId ? `<@${person.slackUserId}>` : escapeSlackText(person.name)] : []));

  return [
    `:rotating_light: *Missed ${TARGET_LABELS[target]} target* on ${escapeSlackText(hardwareRequestTitle(hardwareRequest))}, due ${escapeSlackText(dueLabel)}`,
    [...mentions, `Request ${escapeSlackText(hardwareRequest.id)}`].join(" · ")
  ].join("\n");
}

function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
