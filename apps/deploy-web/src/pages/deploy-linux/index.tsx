import type { ComponentProps } from "react";

import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer/NewDeploymentContainer";
import { createServerSideProps } from "@src/components/new-deployment/NewDeploymentPage/createServerSideProps";
import { RedirectDeployLinuxToConfigure } from "@src/components/new-deployment/RedirectDeployLinuxToConfigure/RedirectDeployLinuxToConfigure";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";

const DeployLinuxWithSdl = withSdlBuilder({
  componentsSet: "ssh",
  imageSource: "ssh-vms"
})(NewDeploymentContainer);

function DeployLinuxPage(props: ComponentProps<typeof NewDeploymentContainer>) {
  return (
    <RedirectDeployLinuxToConfigure>
      <DeployLinuxWithSdl {...props} />
    </RedirectDeployLinuxToConfigure>
  );
}

export default DeployLinuxPage;

export const getServerSideProps = createServerSideProps("/deploy-linux");
