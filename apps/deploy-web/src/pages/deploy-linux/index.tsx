import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { getServerSideProps } from "../new-deployment";

export default withSdlBuilder({
  componentsSet: "ssh",
  imageSource: "ssh-vms"
})(NewDeploymentContainer);

export { getServerSideProps };
