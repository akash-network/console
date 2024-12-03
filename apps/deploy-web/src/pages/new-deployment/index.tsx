import { z } from "zod";

import { NewDeploymentContainer, NewDeploymentContainerProps } from "@src/components/new-deployment/NewDeploymentContainer";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSIdeProps";
import { services } from "@src/services/http/http-server.service";

export default withSdlBuilder()(NewDeploymentContainer);

const contextSchema = z.object({
  query: z.object({
    templateId: z.string().optional()
  })
});

export const getServerSideProps = getValidatedServerSideProps<NewDeploymentContainerProps, typeof contextSchema>(contextSchema, async ({ query }) => {
  if (!query.templateId) {
    return { props: {} };
  }

  try {
    const template = await services.template.findById(query.templateId);

    if (template && query.templateId) {
      return { props: { template, templateId: query.templateId } };
    }
  } catch (error) {
    if (error?.response?.status === 404) {
      console.log("Template not found");
    } else {
      console.error(error);
    }
  }

  return { props: { templateId: query.templateId } };
});
