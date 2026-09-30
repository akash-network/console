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

function describeConfiguration(hardwareRequest: HardwareRequestOutput): string[] {
  const summary = hardwareRequest.configuration?.summary;

  return summary ? [`Current configuration: ${escapeSlackText(summary)}`] : [];
}

function describeLinks(userId: string, links: { amplitudeProjectUrl?: string; adminUrl?: string }): string[] {
  const userLinks: string[] = [];

  if (links.amplitudeProjectUrl) {
    userLinks.push(slackLink(`${links.amplitudeProjectUrl}/search/user_id%3D${encodeURIComponent(userId)}`, "Amplitude sessions"));
  }
  if (links.adminUrl) {
    userLinks.push(slackLink(`${links.adminUrl}/users/${encodeURIComponent(userId)}?tab=hardware-requests`, "Admin"));
  }

  return userLinks.length ? [userLinks.join(" · ")] : [];
}

export function buildHardwareRequestSlackMessage(input: {
  hardwareRequest: HardwareRequestOutput;
  requesterEmail: string | null | undefined;
  amplitudeProjectUrl?: string;
  adminUrl?: string;
}): HardwareRequestSlackMessage {
  const { hardwareRequest } = input;
  const messageLines = [
    `:inbox_tray: *${escapeSlackText(hardwareRequestTitle(hardwareRequest))}*`,
    describeRequester(hardwareRequest, input.requesterEmail),
    ...quote(hardwareRequest.details),
    ...describeConfiguration(hardwareRequest),
    ...describeLinks(hardwareRequest.userId, input)
  ];

  return { text: messageLines.join("\n") };
}
