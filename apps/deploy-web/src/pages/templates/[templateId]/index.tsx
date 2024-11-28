import type { GetServerSideProps } from "next";
import { z } from "zod";

import { TemplateDetail, TemplateDetailProps } from "@src/components/templates/TemplateDetail";
import { services } from "@src/services/http/http-server.service";

export default TemplateDetail;

const contextSchema = z.object({
  params: z.object({
    templateId: z.string()
  })
});
type Params = z.infer<typeof contextSchema>["params"];

export const getServerSideProps: GetServerSideProps<TemplateDetailProps, Params> = async context => {
  const { params } = contextSchema.parse(context);
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
};
