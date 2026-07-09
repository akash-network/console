import { ConfigureDeployment } from "@src/components/deployments/ConfigureDeployment/ConfigureDeployment/ConfigureDeployment";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default ConfigureDeployment;

export const getServerSideProps = defineServerSideProps({
  route: "/new-deployment/configure",
  if: async context => isFeatureEnabled("onboarding_redesign_v1", context)
});
