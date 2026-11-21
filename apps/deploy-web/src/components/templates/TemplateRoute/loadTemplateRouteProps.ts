import type { GetServerSidePropsResult } from "next";

import { dehydrateVisitorQueries } from "@src/components/templates/visitorPages/dehydrateVisitorQueries";
import { resolveMarketplaceAudience } from "@src/components/templates/visitorPages/resolveMarketplaceAudience";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { ITemplate } from "@src/types";
import type { TemplateRouteProps } from "./TemplateRoute";

const GONE_STATUS = 410;

/**
 * A member gets the page as before and loads the template in the browser. A visitor gets it rendered with the template read once on the server;
 * when that read is slow or fails the page is sent without it and the browser loads it.
 */
export async function loadTemplateRouteProps(id: string, context: AppTypedContext): Promise<GetServerSidePropsResult<TemplateRouteProps>> {
  const audience = await resolveMarketplaceAudience(context);
  if (audience.kind === "signIn") return { redirect: audience.redirect };
  if (audience.kind === "member") return audience.isMarketplaceEnabled ? { props: { id, isMarketplace: true } } : loadLegacyTemplateProps(id, context);

  const { visitorAccess } = audience;
  const read = await context.services.marketplaceVisitorReads.template(id);
  if (read.status === "missing") return { notFound: true };
  if (read.status === "unavailable") return { props: { id, isMarketplace: true, visitorAccess } };

  if (read.status === "removed") {
    context.res.statusCode = GONE_STATUS;
    return { props: { id, isMarketplace: true, visitorAccess, removedTemplate: { title: read.title ?? null } } };
  }

  return {
    props: {
      id,
      isMarketplace: true,
      visitorAccess,
      dehydratedState: dehydrateVisitorQueries([{ queryKey: context.services.visitorApiQueries.v1.getUserTemplate.getKey({ id }), data: read.data }])
    }
  };
}

async function loadLegacyTemplateProps(id: string, context: AppTypedContext): Promise<{ props: TemplateRouteProps }> {
  const { services, getCurrentSession } = context;
  const session = await getCurrentSession();
  const config = session ? { headers: { Authorization: `Bearer ${session.accessToken}` } } : {};
  const response = await services.consoleApiHttpClient.get<ITemplate>(
    `${services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID)}/v1/user/template/${id}`,
    config
  );

  return { props: { id, template: response.data } };
}
