import { z } from "zod";

import { DeploymentDetailRouter } from "@src/components/deployments/DeploymentDetail/DeploymentDetailRouter";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default DeploymentDetailRouter;

export const getServerSideProps = defineServerSideProps({
  route: "/deployments/[dseq]",
  schema: z.object({
    params: z.object({
      dseq: z.string().regex(/^\d+$/)
    })
  }),
  async handler({ params }) {
    return {
      props: {
        dseq: params.dseq
      }
    };
  }
});
