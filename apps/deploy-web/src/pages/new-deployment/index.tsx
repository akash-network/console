import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer";
import { createServerSideProps } from "@src/components/new-deployment/NewDeploymentPage/createServerSideProps";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";

export default withSdlBuilder()(NewDeploymentContainer);

export const getServerSideProps = createServerSideProps("/new-deployment");
