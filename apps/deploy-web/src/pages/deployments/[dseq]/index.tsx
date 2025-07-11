import { z } from "zod";

import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default DeploymentDetail;

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
