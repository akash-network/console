import { ConfigureDeploymentContainer } from "@src/components/deployments/ConfigureDeployment/ConfigureDeploymentContainer/ConfigureDeploymentContainer";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default ConfigureDeploymentContainer;

export const getServerSideProps = defineServerSideProps({
  route: "/new-deployment/configure",
  if: async context => isFeatureEnabled("bid_screening", context)
});
