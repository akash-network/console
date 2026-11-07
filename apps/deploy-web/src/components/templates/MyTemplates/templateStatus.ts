import type { UserTemplateListItem } from "@src/types/marketplace-template";

export type TemplateStatus = {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
  reason?: string;
  nextStep?: "contact-support";
};

const HIDDEN: TemplateStatus = { label: "Hidden by Akash", tone: "danger", reason: "Akash hid this template.", nextStep: "contact-support" };
const NOT_SHARED: TemplateStatus = { label: "Not shared", tone: "neutral" };
const SHARED_WITH_ORGANIZATION: TemplateStatus = { label: "Shared with organization", tone: "neutral" };
const IN_GALLERY: TemplateStatus = { label: "In gallery", tone: "success" };
const NOT_IN_GALLERY: TemplateStatus = { label: "Not in gallery", tone: "warning", reason: "Saved before checks existed." };

export const TEMPLATE_STATUS_LABELS = [NOT_SHARED, SHARED_WITH_ORGANIZATION, IN_GALLERY, NOT_IN_GALLERY, HIDDEN].map(status => status.label);

export function templateStatusOf(item: UserTemplateListItem): TemplateStatus {
  if (item.moderationStatus === "hidden") return HIDDEN;
  if (item.visibility === "private") return NOT_SHARED;
  if (item.visibility === "organization") return SHARED_WITH_ORGANIZATION;
  return item.isListed ? IN_GALLERY : NOT_IN_GALLERY;
}
