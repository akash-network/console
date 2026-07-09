import type { ComponentProps } from "react";

import { NewDeploymentContainer } from "@src/components/new-deployment/NewDeploymentContainer/NewDeploymentContainer";
import { createServerSideProps } from "@src/components/new-deployment/NewDeploymentPage/createServerSideProps";
import { RedirectMappableBuilderToConfigure } from "@src/components/new-deployment/RedirectMappableBuilderToConfigure/RedirectMappableBuilderToConfigure";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";

const NewDeploymentWithSdl = withSdlBuilder()(NewDeploymentContainer);

function NewDeploymentPage(props: ComponentProps<typeof NewDeploymentContainer>) {
  return (
    <RedirectMappableBuilderToConfigure>
      <NewDeploymentWithSdl {...props} />
    </RedirectMappableBuilderToConfigure>
  );
}

export default NewDeploymentPage;

export const getServerSideProps = createServerSideProps("/new-deployment");
