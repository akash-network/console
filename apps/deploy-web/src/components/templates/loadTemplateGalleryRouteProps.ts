import type { GetServerSidePropsResult } from "next";

import type { GalleryFirstPage } from "@src/components/templates/communityGallery/galleryFirstPage";
import { buildGalleryFirstPage } from "@src/components/templates/communityGallery/galleryFirstPage";
import { readGalleryView } from "@src/components/templates/communityGallery/galleryView";
import { resolveMarketplaceAudience } from "@src/components/templates/visitorPages/resolveMarketplaceAudience";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { VisitorPageProps } from "@src/lib/pages/visitorAccess/visitorAccess";
import { toCategoriesAndTemplates } from "@src/queries/templateCategories";

export interface TemplateGalleryRouteProps extends VisitorPageProps {
  firstPage?: GalleryFirstPage;
}

/**
 * A member gets the gallery as before and loads its lists in the browser. A visitor gets the first screen of the view in the link rendered on the server,
 * from two reads the server keeps for a minute; when either is slow or fails the page is sent without it and the browser loads everything.
 */
export async function loadTemplateGalleryRouteProps(context: AppTypedContext): Promise<GetServerSidePropsResult<TemplateGalleryRouteProps>> {
  const audience = await resolveMarketplaceAudience(context);
  if (audience.kind === "signIn") return { redirect: audience.redirect };
  if (audience.kind === "member") return { props: {} };

  const { visitorAccess } = audience;
  const reads = context.services.marketplaceVisitorReads;
  const [community, awesomeAkash] = await Promise.all([reads.communityGallery(), reads.awesomeAkashCategories()]);
  if (community.status !== "found" || awesomeAkash.status !== "found") return { props: { visitorAccess } };

  const firstPage = buildGalleryFirstPage({
    categories: toCategoriesAndTemplates(awesomeAkash.data).categories,
    community: community.data.data,
    view: readGalleryView(context.query)
  });

  return { props: { visitorAccess, firstPage: JSON.parse(JSON.stringify(firstPage)) } };
}
