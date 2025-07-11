import { z } from "zod";

import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export const createServerSideProps = (route: string) =>
  defineServerSideProps({
    route,
    schema: z.object({
      query: z.object({
        templateId: z.string().optional()
      })
    }),
    async handler({ query, services }) {
      if (!query.templateId) {
        return { props: {} };
      }

      const template = await services.template.findById(query.templateId).catch(error => {
        services.logger.warn({ error });
        return null;
      });

      if (template && query.templateId) {
        return { props: { template, templateId: query.templateId } };
      }

      return { props: { templateId: query.templateId } };
    }
  });
