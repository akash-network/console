import { z } from "zod";

import { loadTemplateDetailRouteProps } from "@src/components/templates/loadTemplateDetailRouteProps";
import { TemplateDetail } from "@src/components/templates/TemplateDetail";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default TemplateDetail;

export const getServerSideProps = defineServerSideProps({
  route: "/templates/[templateId]",
  public: true,
  schema: z.object({
    params: z.object({
      templateId: z.string()
    })
  }),
  handler: context => loadTemplateDetailRouteProps(context.params.templateId, context)
});
