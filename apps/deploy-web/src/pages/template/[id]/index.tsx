import { z } from "zod";

import { loadTemplateRouteProps } from "@src/components/templates/TemplateRoute/loadTemplateRouteProps";
import { TemplateRoute } from "@src/components/templates/TemplateRoute/TemplateRoute";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default TemplateRoute;

export const getServerSideProps = defineServerSideProps({
  route: "/template/[id]",
  schema: z.object({
    params: z.object({
      id: z.string()
    })
  }),
  handler: context => loadTemplateRouteProps(context.params.id, context)
});
