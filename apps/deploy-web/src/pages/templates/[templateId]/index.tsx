import { z } from "zod";

import { TemplateDetail } from "@src/components/templates/TemplateDetail";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { getShortText } from "@src/utils/stringUtils";
import { domainName, UrlService } from "@src/utils/urlUtils";

export default TemplateDetail;

export const getServerSideProps = defineServerSideProps({
  route: "/templates/[templateId]",
  schema: z.object({
    params: z.object({
      templateId: z.string()
    })
  }),
  async handler({ params, services }) {
    const template = await services.template.findById(params.templateId);

    if (!template) {
      return {
        notFound: true
      };
    }

    const url = `${domainName}${UrlService.templateDetails(params.templateId)}`;
    const description = getShortText(template.summary || "", 140);
    const title = `Template detail ${template.name}`;

    return {
      props: {
        template,
        seo: {
          title,
          description,
          canonical: url,
          openGraph: {
            title,
            description,
            url,
            images: [
              {
                url: template.logoUrl,
                width: 1200,
                height: 630,
                alt: "Template image"
              }
            ]
          }
        }
      }
    };
  }
});
