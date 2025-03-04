import { z } from "zod";

import { TemplateDetail, TemplateDetailProps } from "@src/components/templates/TemplateDetail";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSIdeProps";
import { services } from "@src/services/http/http-server.service";
import { getShortText } from "@src/utils/stringUtils";
import { UrlService } from "@src/utils/urlUtils";
import { domainName } from "@src/utils/urlUtils";

export default TemplateDetail;

const contextSchema = z.object({
  params: z.object({
    templateId: z.string()
  })
});

export const getServerSideProps = getValidatedServerSideProps<TemplateDetailProps, typeof contextSchema>(contextSchema, async ({ params }) => {
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
});
