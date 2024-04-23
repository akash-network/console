import { Title } from "@src/components/shared/Title";
import { PageContainer } from "@src/components/shared/PageContainer";
import React from "react";
import { UrlService } from "@src/utils/urlUtils";
import { RentGpusForm } from "@src/components/sdl/RentGpusForm";
import Layout from "@src/components/layout/Layout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";

function RentGpuPage() {
  return (
    <Layout>
      <CustomNextSeo
        title="Rent GPUs"
        url={`https://deploy.cloudmos.io${UrlService.sdlBuilder()}`}
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
