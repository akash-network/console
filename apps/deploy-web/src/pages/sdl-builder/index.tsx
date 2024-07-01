import React from "react";

import Layout from "@src/components/layout/Layout";
import { SimpleSDLBuilderForm } from "@src/components/sdl/SimpleSdlBuilderForm";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { Title } from "@src/components/shared/Title";
import { withSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { domainName, UrlService } from "@src/utils/urlUtils";

function SDLBuilderPage() {
  return (
    <Layout>
      <CustomNextSeo
        title="SDL Builder"
        url={`${domainName}${UrlService.sdlBuilder()}`}
        description="Build your own SDL configuration to deploy a docker container on the Akash Network, the #1 decentralized supercloud."
      />

      <Title>SDL Builder</Title>

      <SimpleSDLBuilderForm />
    </Layout>
  );
}

export default withSdlBuilder()(SDLBuilderPage);
