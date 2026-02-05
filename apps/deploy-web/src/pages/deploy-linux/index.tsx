import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer/NewDeploymentContainer";
import { createServerSideProps } from "@src/components/new-deployment/NewDeploymentPage/createServerSideProps";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";

export default withSdlBuilder({
  componentsSet: "ssh",
  imageSource: "ssh-vms"
})(NewDeploymentContainer);

export const getServerSideProps = createServerSideProps("/deploy-linux");
