import { z } from "zod";

import type { TemplateDetailProps } from "@src/components/templates/TemplateDetail";
import { TemplateDetail } from "@src/components/templates/TemplateDetail";
import type { ServerServicesContext } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import type { ValidatedServerSideContext } from "@src/lib/nextjs/getValidatedServerSideProps";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSideProps";
import { getShortText } from "@src/utils/stringUtils";
import { UrlService } from "@src/utils/urlUtils";
import { domainName } from "@src/utils/urlUtils";

export default TemplateDetail;

const contextSchema = z.object({
  params: z.object({
    templateId: z.string()
  })
});

export const getServerSideProps = getServerSidePropsWithServices(
  getValidatedServerSideProps<TemplateDetailProps, typeof contextSchema, ServerServicesContext & ValidatedServerSideContext<typeof contextSchema>>(
    contextSchema,
    async ({ params, services }) => {
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
  )
);
