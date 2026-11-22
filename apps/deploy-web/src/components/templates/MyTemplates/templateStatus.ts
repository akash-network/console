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
const NOT_IN_GALLERY: TemplateStatus = {
  label: "Not in gallery",
  tone: "warning",
  reason: "It went public before publish checks existed.",
  nextStep: "share"
};

/** The list carries only the current version today, so a held or failed newer version shows once the API lists it. */
const VERSION_NOTES: Partial<Record<VersionStatus, TemplateVersionNote & { describe: (version: number) => string }>> = {
  held: { label: "Held for review", tone: "warning", describe: version => `v${version} held for review` },
  failed_checks: { label: "Failed checks", tone: "danger", describe: version => `v${version} failed checks` }
};

export const TEMPLATE_STATUS_LABELS = [NOT_SHARED, SHARED_WITH_ORGANIZATION, IN_GALLERY, NOT_IN_GALLERY, HIDDEN].map(status => status.label);

export function templateStatusOf(item: UserTemplateListItem): TemplateStatus {
  const versionNote = versionNoteOf(item.currentVersion);
  const status = sharingStatusOf(item);
  return versionNote ? { ...status, versionNote } : status;
}

function sharingStatusOf(item: UserTemplateListItem): TemplateStatus {
  if (item.moderationStatus === "hidden") return HIDDEN;
  if (item.visibility === "private") return NOT_SHARED;
  if (item.visibility === "organization") return SHARED_WITH_ORGANIZATION;
  return item.isListed ? IN_GALLERY : NOT_IN_GALLERY;
}

function versionNoteOf(version: UserTemplateListItem["currentVersion"]): TemplateVersionNote | undefined {
  const note = version && VERSION_NOTES[version.status];
  return note ? { label: note.describe(version.version), tone: note.tone } : undefined;
}
