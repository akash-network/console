import { LoggerService } from "@akashnetwork/logging";
import { z } from "zod";

import type { NewDeploymentContainerProps } from "@src/components/new-deployment/NewDeploymentContainer";
import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import type { ServerServicesContext } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import type { ValidatedServerSideContext } from "@src/lib/nextjs/getValidatedServerSideProps";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSideProps";

export default withSdlBuilder()(NewDeploymentContainer);

const contextSchema = z.object({
  query: z.object({
    templateId: z.string().optional()
  })
});

const logger = LoggerService.forContext(NewDeploymentContainer.name);

export const getServerSideProps = getServerSidePropsWithServices(
  getValidatedServerSideProps<NewDeploymentContainerProps, typeof contextSchema, ServerServicesContext & ValidatedServerSideContext<typeof contextSchema>>(
    contextSchema,
    async ({ query, services }) => {
      if (!query.templateId) {
        return { props: {} };
      }

      try {
        const template = await services.template.findById(query.templateId);

        if (template && query.templateId) {
          return { props: { template, templateId: query.templateId } };
        }
      } catch (error: any) {
        if (error?.response?.status === 404) {
          logger.info(`Template not found: ${query.templateId}`);
        } else {
          logger.error(error);
        }
      }

      return { props: { templateId: query.templateId } };
    }
  )
);
