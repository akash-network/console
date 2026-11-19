import type { MarketplaceTemplate } from "@src/types/marketplace-template";

export type ReportViewer = {
  username: string | undefined;
  organizations: { type: "personal" | "team"; slug: string | null }[];
};

type ReportedTemplate = Pick<MarketplaceTemplate, "visibility" | "moderationStatus" | "canEdit" | "publisher" | "author">;

/** The API refuses a report from any member of the publishing organization, and the template names that organization only by slug or, for a personal one, by its author. */
export function canReportTemplate(template: ReportedTemplate, viewer: ReportViewer): boolean {
  if (template.visibility !== "public" || template.moderationStatus !== "active") return false;

  return !template.canEdit && !isPublishedByViewer(template, viewer);
}

function isPublishedByViewer({ publisher, author }: ReportedTemplate, viewer: ReportViewer): boolean {
  if (publisher?.type === "team") {
    return viewer.organizations.some(organization => organization.type === "team" && !!organization.slug && organization.slug === publisher.slug);
  }

  return !!viewer.username && author?.username === viewer.username;
}
