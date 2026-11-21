import type { UserTemplateListItem } from "@src/types/marketplace-template";

type Tone = "neutral" | "success" | "warning" | "danger";

type VersionStatus = NonNullable<UserTemplateListItem["currentVersion"]>["status"];

export type TemplateVersionNote = { label: string; tone: Tone };

export type TemplateStatus = {
  label: string;
  tone: Tone;
  reason?: string;
  nextStep?: "contact-support" | "share";
  /** Set when a version needs attention while the template's own status stands. */
  versionNote?: TemplateVersionNote;
};

const HIDDEN: TemplateStatus = { label: "Hidden by Akash", tone: "danger", reason: "Akash hid this template.", nextStep: "contact-support" };
const NOT_SHARED: TemplateStatus = { label: "Not shared", tone: "neutral" };
const SHARED_WITH_ORGANIZATION: TemplateStatus = { label: "Shared with organization", tone: "neutral" };
const IN_GALLERY: TemplateStatus = { label: "In gallery", tone: "success" };
const NEVER_LISTED: TemplateStatus = {
  label: "Not in gallery",
  tone: "warning",
  reason: "It went public before publish checks existed.",
  nextStep: "share"
};
const TAKEN_OUT_OF_GALLERY: TemplateStatus = {
  label: "Not in gallery",
  tone: "warning",
  reason: "It was taken out of the gallery.",
  nextStep: "share"
};

const VERSION_NOTES: Partial<Record<VersionStatus, { tone: Tone; describe: (version: number) => string }>> = {
  held: { tone: "warning", describe: version => `v${version} held for review` },
  failed_checks: { tone: "danger", describe: version => `v${version} failed checks` },
  rejected: { tone: "danger", describe: version => `v${version} rejected by staff` }
};

export const TEMPLATE_STATUS_LABELS = [NOT_SHARED, SHARED_WITH_ORGANIZATION, IN_GALLERY, NEVER_LISTED, HIDDEN].map(status => status.label);

export function templateStatusOf(item: UserTemplateListItem): TemplateStatus {
  const versionNote = versionNoteOf(item);
  const status = sharingStatusOf(item);
  return versionNote ? { ...status, versionNote } : status;
}

function sharingStatusOf(item: UserTemplateListItem): TemplateStatus {
  if (item.moderationStatus === "hidden") return HIDDEN;
  if (item.visibility === "private") return NOT_SHARED;
  if (item.visibility === "organization") return SHARED_WITH_ORGANIZATION;
  if (item.isListed) return IN_GALLERY;
  return item.publishedAt ? TAKEN_OUT_OF_GALLERY : NEVER_LISTED;
}

/** The newest version is the one that needs attention while an older one stays current; a viewer gets none, so the current one is read instead. */
function versionNoteOf({ latestVersion, currentVersion }: UserTemplateListItem): TemplateVersionNote | undefined {
  const version = latestVersion ?? currentVersion;
  const note = version && VERSION_NOTES[version.status];
  return note ? { label: note.describe(version.version), tone: note.tone } : undefined;
}
