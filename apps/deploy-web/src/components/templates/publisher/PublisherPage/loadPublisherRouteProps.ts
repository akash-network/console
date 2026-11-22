import type { DehydratedState } from "@tanstack/react-query";
import type { GetServerSidePropsResult } from "next";

import { buildGalleryEntries, filterGalleryEntries, GALLERY_PAGE_SIZE, sortGalleryEntries } from "@src/components/templates/communityGallery/galleryEntries";
import type { GalleryView } from "@src/components/templates/communityGallery/galleryView";
import { readGalleryView } from "@src/components/templates/communityGallery/galleryView";
import { dehydrateVisitorQueries } from "@src/components/templates/visitorPages/dehydrateVisitorQueries";
import { resolveMarketplaceAudience } from "@src/components/templates/visitorPages/resolveMarketplaceAudience";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { VisitorPageProps } from "@src/lib/pages/visitorAccess/visitorAccess";
import type { VisitorPublisherResponse } from "@src/services/marketplace-visitor-reads/marketplace-visitor-reads.service";

export interface PublisherRouteProps extends VisitorPageProps {
  handle: string;
  dehydratedState?: DehydratedState;
}

/**
 * A member gets the page as before and loads it in the browser. A visitor gets it rendered with the publisher read once on the server;
 * when that read is slow or fails the page is sent without it and the browser loads it.
 */
export async function loadPublisherRouteProps(handle: string, context: AppTypedContext): Promise<GetServerSidePropsResult<PublisherRouteProps>> {
  const audience = await resolveMarketplaceAudience(context);
  if (audience.kind === "signIn") return { redirect: audience.redirect };
  if (audience.kind === "member") return audience.isMarketplaceEnabled ? { props: { handle } } : { notFound: true };

  const { visitorAccess } = audience;
  const read = await context.services.marketplaceVisitorReads.publisher(handle);
  if (read.status === "unavailable") return { props: { handle, visitorAccess } };
  if (read.status !== "found") return { notFound: true };

  const firstPage = selectPublisherFirstPage(read.data, readGalleryView(context.query));

  return {
    props: {
      handle,
      visitorAccess,
      dehydratedState: dehydrateVisitorQueries([
        {
          queryKey: context.services.visitorApiQueries.v1.getTemplatePublisher.getKey({ handle }),
          data: firstPage,
          isPartial: firstPage !== read.data
        }
      ])
    }
  };
}

/** A publisher can list a thousand templates and the page shows 24 at a time, so the page carries the cards of its first screen and the browser loads the rest. */
export function selectPublisherFirstPage(response: VisitorPublisherResponse, view: Pick<GalleryView, "search" | "sort">): VisitorPublisherResponse {
  const { templates } = response.data;
  if (templates.length <= GALLERY_PAGE_SIZE) return response;

  const entries = buildGalleryEntries({ categories: [], community: { templates, officialUsage: {} } });
  const shown = filterGalleryEntries(sortGalleryEntries(entries, view.sort), { source: "all", category: null, search: view.search }).slice(
    0,
    GALLERY_PAGE_SIZE
  );
  const shownIds = new Set(shown.map(entry => entry.id));

  return { ...response, data: { ...response.data, templates: templates.filter(template => shownIds.has(template.id)) } };
}
