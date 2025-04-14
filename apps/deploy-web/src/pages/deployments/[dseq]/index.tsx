import { z } from "zod";

import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";
import type { ServerServicesContext } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import type { ValidatedServerSideContext } from "@src/lib/nextjs/getValidatedServerSideProps";
import { getValidatedServerSideProps } from "@src/lib/nextjs/getValidatedServerSideProps";

export default DeploymentDetail;

const contextSchema = z.object({
  params: z.object({
    dseq: z.string().regex(/^\d+$/)
  })
});

export const getServerSideProps = getServerSidePropsWithServices(
  getValidatedServerSideProps(contextSchema, async (ctx: ServerServicesContext & ValidatedServerSideContext<typeof contextSchema>) => {
    return {
      props: {
        dseq: ctx.params.dseq
      }
    };
  })
);
