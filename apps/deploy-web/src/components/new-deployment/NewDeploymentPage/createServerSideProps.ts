import { z } from "zod";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export const createServerSideProps = (route: string) =>
  defineServerSideProps({
    route,
    schema: z.object({
      query: z.object({
        templateId: z.string().optional(),
        repoUrl: z
          .string()
          .optional()
          .refine(val => !val || /^https?:\/\/(www\.)?(github|gitlab|bitbucket)\.(com|org)(?:\/|[?#]|$)/i.test(val), {
            message: "repoUrl must start with github, gitlab, or bitbucket URL"
          })
      })
    }),
    async handler({ query, services }) {
      if (query.repoUrl) {
        return { props: { isDeployButtonFlow: true, templateId: CI_CD_TEMPLATE_ID } };
      }

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
