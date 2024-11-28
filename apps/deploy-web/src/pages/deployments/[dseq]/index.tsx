import { z } from "zod";

import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSIdeProps";
import { services } from "@src/services/http/http-server.service";

export default DeploymentDetail;

const contextSchema = z.object({
  params: z.object({
    dseq: z.string().regex(/^\d+$/)
  })
});

export const getServerSideProps = getValidatedServerSideProps(contextSchema, async ({ params }) => {
  const remoteDeployTemplate = await services.template.findById(CI_CD_TEMPLATE_ID);

  return {
    props: {
      remoteDeployTemplate,
      dseq: params.dseq
    }
  };
});
