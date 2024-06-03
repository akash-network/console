import React from "react";

import Layout from "@src/components/layout/Layout";
import { RentGpusForm } from "@src/components/sdl/RentGpusForm";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { Title } from "@src/components/shared/Title";
import { domainName,UrlService } from "@src/utils/urlUtils";

function RentGpuPage() {
  return (
    <Layout>
      <CustomNextSeo
        title="Rent GPUs"
        url={`${domainName}${UrlService.sdlBuilder()}`}
        description="Experience Global GPU Rental Excellence: Seamlessly Deploy AI Workloads with Docker Containers on Kubernetes"
      />

      <Title>Rent GPUs</Title>

      <p className="mb-8 text-muted-foreground">
        Deploy any AI workload on a wide variety of Nvidia GPU models. Select from one of the available templates or input your own docker container image to
        deploy on one of the providers available worldwide on the network.
      </p>

      <RentGpusForm />
    </Layout>
  );
}

export default RentGpuPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
