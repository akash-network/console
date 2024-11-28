import type { GetServerSideProps } from "next";
import { z } from "zod";

import { DeploymentDetail, DeploymentDetailProps } from "@src/components/deployments/DeploymentDetail";
import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { services } from "@src/services/http/http-server.service";

export default DeploymentDetail;

const contextSchema = z.object({
  params: z.object({
    dseq: z.string()
  })
});
type Params = z.infer<typeof contextSchema>["params"];

export const getServerSideProps: GetServerSideProps<DeploymentDetailProps, Params> = async context => {
  const { params } = contextSchema.parse(context);
  const remoteDeployTemplate = await services.template.findById(CI_CD_TEMPLATE_ID);

  return {
    props: {
      remoteDeployTemplate,
      dseq: params.dseq
    }
  };
};
