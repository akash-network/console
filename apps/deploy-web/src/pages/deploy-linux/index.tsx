import { createServerSideProps } from "@src/components/new-deployment/NewDeploymentPage/createServerSideProps";
import { RedirectDeployLinuxToConfigure } from "@src/components/new-deployment/RedirectDeployLinuxToConfigure/RedirectDeployLinuxToConfigure";

function DeployLinuxPage() {
  return <RedirectDeployLinuxToConfigure />;
}

export default DeployLinuxPage;

export const getServerSideProps = createServerSideProps("/deploy-linux");
