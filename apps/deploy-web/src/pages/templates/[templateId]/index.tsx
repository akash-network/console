import { z } from "zod";

import { TemplateDetail, TemplateDetailProps } from "@src/components/templates/TemplateDetail";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSIdeProps";
import { services } from "@src/services/http/http-server.service";

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

  return {
    props: {
      templateId: params.templateId,
      template
    }
  };
});
