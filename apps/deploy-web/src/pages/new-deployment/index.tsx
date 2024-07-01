import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";

export default withSdlBuilder({ componentsSet: "ssh-toggled" })(NewDeploymentContainer);
