import { z } from "zod";

import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSIdeProps";

export default DeploymentDetail;

const contextSchema = z.object({
  params: z.object({
    dseq: z.string().regex(/^\d+$/)
  })
});

export const getServerSideProps = getValidatedServerSideProps(contextSchema, async ({ params }) => {
  return {
    props: {
      dseq: params.dseq
    }
  };
});
