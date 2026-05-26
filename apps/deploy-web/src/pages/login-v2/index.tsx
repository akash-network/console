import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { z } from "zod";

import { AuthPagePasswordlessClient } from "@src/components/auth/AuthPagePasswordless/AuthPagePasswordless";
import { useFlag } from "@src/hooks/useFlag";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";
import onboardingStore from "@src/store/onboardingStore";

export default function LoginV2Page() {
  const isOnboardingRedesignEnabled = useFlag("console_onboarding_redesign");
  const setSelectedOnboardingFlow = useSetAtom(onboardingStore.selectedOnboardingFlow);

  useEffect(
    function markOnboardingFlowAsRedesign() {
      if (!isOnboardingRedesignEnabled) return;
      setSelectedOnboardingFlow("redesign");
    },
    [isOnboardingRedesignEnabled, setSelectedOnboardingFlow]
  );

  return <AuthPagePasswordlessClient />;
}

export const getServerSideProps = defineServerSideProps({
  route: "/login-v2",
  schema: z.object({
    query: z.object({
      returnTo: z.union([z.string(), z.array(z.string())]).optional()
    })
  }),
  handler: async ctx => {
    if (await isAuthenticated(ctx)) {
      return { redirect: { destination: "/", permanent: false } };
    }
    if (!(await isFeatureEnabled("console_onboarding_redesign", ctx))) {
      return { redirect: { destination: "/login", permanent: false } };
    }
    return { props: {} };
  }
});
