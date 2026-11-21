import type { TemplateOutput } from "@akashnetwork/http-sdk";
import type { GetServerSidePropsResult } from "next";
import type { NextSeoProps } from "next-seo/lib/types";

import { resolveMarketplaceAudience } from "@src/components/templates/visitorPages/resolveMarketplaceAudience";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { VisitorPageProps } from "@src/lib/pages/visitorAccess/visitorAccess";
import { AWESOME_AKASH_TEMPLATE_TITLE_PREFIX } from "@src/services/analytics/marketplace-page-title.plugin";
import type { VisitorRead } from "@src/services/marketplace-visitor-reads/marketplace-visitor-reads.service";
import { getShortText } from "@src/utils/stringUtils";
import { domainName, UrlService } from "@src/utils/urlUtils";

export interface TemplateDetailRouteProps extends VisitorPageProps {
  template: TemplateOutput;
  seo: NextSeoProps;
}

/**
 * The page of an awesome-akash template, which the gallery links its Official cards to: a member gets it as before, a visitor once the marketplace is on for visitors.
 * The page cannot render without its template, so a visitor whose read is slow or fails is sent to the gallery instead of an error page.
 */
export async function loadTemplateDetailRouteProps(templateId: string, context: AppTypedContext): Promise<GetServerSidePropsResult<TemplateDetailRouteProps>> {
  const audience = await resolveMarketplaceAudience(context);
  if (audience.kind === "signIn") return { redirect: audience.redirect };

  const read =
    audience.kind === "visitor" ? await context.services.marketplaceVisitorReads.awesomeAkashTemplate(templateId) : await readForMember(templateId, context);
  if (read.status === "unavailable") return { redirect: { destination: UrlService.templates(), permanent: false } };
  if (read.status !== "found") return { notFound: true };

  const template = read.data;

  const url = `${domainName}${UrlService.templateDetails(templateId)}`;
  const description = getShortText(template.summary || "", 140);
  const title = `${AWESOME_AKASH_TEMPLATE_TITLE_PREFIX}${template.name}`;

  return {
    props: {
      template,
      ...(audience.kind === "visitor" && { visitorAccess: audience.visitorAccess }),
      seo: {
        title,
        description,
        canonical: url,
        openGraph: {
          title,
          description,
          url,
          ...(template.logoUrl && {
            images: [
              {
                url: template.logoUrl,
                width: 1200,
                height: 630,
                alt: "Template image"
              }
            ]
          })
        }
      }
    }
  };
}

async function readForMember(templateId: string, context: AppTypedContext): Promise<VisitorRead<TemplateOutput>> {
  const template = await context.services.template.findById(templateId);
  return template ? { status: "found", data: template } : { status: "missing" };
}
