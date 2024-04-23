import React from "react";
import { Title } from "@src/components/shared/Title";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "@src/components/layout/Layout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { SimpleSDLBuilderForm } from "@src/components/sdl/SimpleSdlBuilderForm";

function SDLBuilderPage() {
  return (
    <Layout>
      <CustomNextSeo
        title="SDL Builder"
        url={`https://deploy.cloudmos.io${UrlService.sdlBuilder()}`}
        description="Build your own SDL configuration to deploy a docker container on the Akash Network, the #1 decentralized supercloud."
      />

      <Title>SDL Builder</Title>

      <SimpleSDLBuilderForm />
    </Layout>
  );
}

export default SDLBuilderPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
