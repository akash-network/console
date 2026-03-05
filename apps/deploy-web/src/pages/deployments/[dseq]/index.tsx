import { z } from "zod";

import { DeploymentDetail } from "@src/components/deployments/DeploymentDetail";
import OnboardingRedirect from "@src/components/onboarding/OnboardingRedirect/OnboardingRedirect";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsOnboarded } from "@src/hooks/useIsOnboarded";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default Guard(DeploymentDetail, useIsOnboarded, OnboardingRedirect);

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
