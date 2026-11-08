import {
  describeAccount,
  describeLane,
  type HardwareRequestAlertContext,
  salesOwnerOf
} from "@src/hardware-request/lib/hardware-request-alert-summary/hardware-request-alert-summary";
import { describeSpec } from "@src/hardware-request/lib/hardware-request-spec-summary/hardware-request-spec-summary";
import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export interface HardwareRequestSlackMessage {
  text: string;
}

function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function slackLink(url: string, label: string): string {
  return `<${url}|${label}>`;
}

function describeRequester(hardwareRequest: HardwareRequestOutput, requesterEmail: string | null | undefined): string {
  if (!hardwareRequest.userId) return `${escapeSlackText(hardwareRequest.contactEmail)} · no account yet`;

  const requester = escapeSlackText(requesterEmail || hardwareRequest.userId);

  if (hardwareRequest.contactEmail.toLowerCase() === requesterEmail?.toLowerCase()) {
    return requester;
  }

  return `${requester} · reply to ${escapeSlackText(hardwareRequest.contactEmail)}`;
}

function quote(text: string | null): string[] {
  if (!text) return [];

  return escapeSlackText(text)
    .split(/\r?\n/)
    .map(line => `> ${line}`);
}

function describeRouting(hardwareRequest: HardwareRequestOutput, context: HardwareRequestAlertContext): string {
  const owner = salesOwnerOf(hardwareRequest, context);
  const mention = owner && (owner.slackUserId ? `<@${owner.slackUserId}>` : escapeSlackText(owner.name));

  return [`*${escapeSlackText(describeLane(hardwareRequest))}*`, mention].filter(Boolean).join(" · ");
}

function describeSpecLines(hardwareRequest: HardwareRequestOutput): string[] {
  return hardwareRequest.spec ? describeSpec(hardwareRequest.spec).map(line => `• ${escapeSlackText(line)}`) : [];
}

function describeConfiguration(hardwareRequest: HardwareRequestOutput): string[] {
  const summary = hardwareRequest.configuration?.summary;

  return summary ? [`Sent while configuring: ${escapeSlackText(summary)}`] : [];
}

function describeLinks(hardwareRequest: HardwareRequestOutput, links: { amplitudeProjectUrl?: string; adminUrl?: string }): string[] {
  const { id, userId } = hardwareRequest;
  const requestLinks: string[] = [];

  if (links.adminUrl) {
    requestLinks.push(slackLink(`${links.adminUrl}/hardware-requests/${encodeURIComponent(id)}`, "Match report"));
  }
  if (userId && links.amplitudeProjectUrl) {
    requestLinks.push(slackLink(`${links.amplitudeProjectUrl}/search/user_id%3D${encodeURIComponent(userId)}`, "Amplitude sessions"));
  }
  if (userId && links.adminUrl) {
    requestLinks.push(slackLink(`${links.adminUrl}/users/${encodeURIComponent(userId)}?tab=hardware-requests`, "User in admin"));
  }

  return requestLinks.length ? [requestLinks.join(" · ")] : [];
}

export function buildHardwareRequestSlackMessage(input: {
  hardwareRequest: HardwareRequestOutput;
  requesterEmail: string | null | undefined;
  context: HardwareRequestAlertContext;
  amplitudeProjectUrl?: string;
  adminUrl?: string;
}): HardwareRequestSlackMessage {
  const { hardwareRequest } = input;
  const messageLines = [
    `:inbox_tray: *${escapeSlackText(hardwareRequestTitle(hardwareRequest))}*`,
    describeRouting(hardwareRequest, input.context),
    escapeSlackText(describeAccount(hardwareRequest, input.context)),
    describeRequester(hardwareRequest, input.requesterEmail),
    ...describeSpecLines(hardwareRequest),
    ...quote(hardwareRequest.details),
    ...describeConfiguration(hardwareRequest),
    ...describeLinks(hardwareRequest, input)
  ];

  return { text: messageLines.join("\n") };
}
