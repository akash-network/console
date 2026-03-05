import { z } from "zod";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { UrlService } from "@src/utils/urlUtils";

export const createServerSideProps = (route: string) =>
  defineServerSideProps({
    route,
    schema: z.object({
      query: z.object({
        templateId: z.string().optional(),
        branch: z.string().optional(),
        step: z.string().optional(),
        dseq: z.string().optional(),
        redeploy: z.string().optional(),
        gitProviderCode: z.string().optional(),
        gitProvider: z.string().optional(),
        buildCommand: z.string().optional(),
        startCommand: z.string().optional(),
        installCommand: z.string().optional(),
        buildDirectory: z.string().optional(),
        nodeVersion: z.string().optional(),
        repoUrl: z
          .string()
          .optional()
          .refine(val => !val || /^https?:\/\/(www\.)?(github|gitlab|bitbucket)\.(com|org)(?:\/|[?#]|$)/i.test(val), {
            message: "repoUrl must start with github, gitlab, or bitbucket URL"
          })
      })
    }),
    async handler({ query, services }) {
      const { templateId } = query;

      if (!templateId && !query.repoUrl) {
        return { props: {} };
      }

      if (!templateId) {
        query = { ...query, templateId: CI_CD_TEMPLATE_ID };
        return { redirect: { destination: UrlService.newDeployment(query), permanent: false } };
      }

      const template = await services.template.findById(templateId).catch(error => {
        services.logger.warn({ error });
        return null;
      });

      if (template && templateId) {
        return { props: { template, templateId } };
      }

      return { props: { templateId } };
    }
  });
