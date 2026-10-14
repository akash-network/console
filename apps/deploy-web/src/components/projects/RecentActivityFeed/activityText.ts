import type { OrganizationActivity, OrganizationActivityPayload } from "@src/types/organization-activity";
import { readActivityPayload } from "@src/types/organization-activity";

export type ActivitySegment = { kind: "text"; text: string } | { kind: "strong"; text: string } | { kind: "deployment"; text: string; dseq: string };

export type ActivitySystemIcon = "clock" | "wallet" | "activity";

export interface ActivityText {
  segments: ActivitySegment[];
  /** The glyph standing in for an avatar on an event no member caused. */
  systemIcon: ActivitySystemIcon;
}

const text = (value: string): ActivitySegment => ({ kind: "text", text: value });
const strong = (value: string): ActivitySegment => ({ kind: "strong", text: value });

/** Turns an activity record into the "actor verb object" sentence the feed shows, with the deployment it names as a link. */
export function describeActivity(activity: OrganizationActivity): ActivityText {
  const payload = readActivityPayload(activity.payload);

  switch (activity.type) {
    case "organization_created":
      return { segments: [text("created the organization")], systemIcon: "activity" };
    case "project_created":
      return { segments: [text("created the project"), strong(payload.projectName ?? "a project")], systemIcon: "activity" };
    case "member_invited":
      return { segments: [text("invited"), strong(payload.email ?? "someone"), text(`as ${withArticle(roleLabel(payload.role))}`)], systemIcon: "activity" };
    case "member_joined":
      return {
        segments: activity.actor ? [text("joined the organization")] : [strong(payload.email ?? "Someone"), text("joined the organization")],
        systemIcon: "activity"
      };
    case "deployment_created":
      return { segments: [text("deployed"), deploymentSegment(payload)], systemIcon: "activity" };
    case "deployment_closed":
      return describeClosedDeployment(activity);
    case "deployment_moved":
      return { segments: [text("moved"), deploymentSegment(payload), text("to"), strong(payload.toProjectName ?? "another project")], systemIcon: "activity" };
    case "member_granted":
      return {
        segments: [text("gave"), strong(payload.username ?? "a member"), text(`access as ${withArticle(roleLabel(payload.role))}`)],
        systemIcon: "activity"
      };
    case "member_revoked":
      return { segments: [text("removed access for"), strong(payload.username ?? "a member")], systemIcon: "activity" };
    default:
      return { segments: [text("made a change")], systemIcon: "activity" };
  }
}

/** The reasons the console records when it closes a deployment on its own. */
const SYSTEM_CLOSE_TEXTS: Record<string, { text: string; systemIcon: ActivitySystemIcon }> = {
  runtime_limit_reached: { text: "was closed when its runtime limit ran out", systemIcon: "clock" },
  trial_ended: { text: "was closed when the trial ended", systemIcon: "wallet" },
  provider_unreachable: { text: "was closed when its provider stopped responding", systemIcon: "activity" }
};

function describeClosedDeployment(activity: OrganizationActivity): ActivityText {
  const payload = readActivityPayload(activity.payload);
  if (activity.actor) return { segments: [text("closed"), deploymentSegment(payload)], systemIcon: "activity" };

  const systemClose = (payload.reason && SYSTEM_CLOSE_TEXTS[payload.reason]) || { text: "was closed", systemIcon: "activity" };
  return { segments: [deploymentSegment(payload), text(systemClose.text)], systemIcon: systemClose.systemIcon };
}

function deploymentSegment(payload: OrganizationActivityPayload): ActivitySegment {
  const label = payload.name || (payload.dseq ? `#${payload.dseq}` : "a deployment");
  return payload.dseq ? { kind: "deployment", text: label, dseq: payload.dseq } : strong(label);
}

function roleLabel(role: string | undefined): string {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}
