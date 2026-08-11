import { z } from "zod";

import { DeploymentDetailPreview } from "@src/components/deployments/DeploymentDetail/DeploymentDetailPreview";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default DeploymentDetailPreview;

export const getServerSideProps = defineServerSideProps({
  route: "/deployments/[dseq]/preview",
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
