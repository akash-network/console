import { Title } from "@src/components/shared/Title";
import { PageContainer } from "@src/components/shared/PageContainer";
import React from "react";
import { UrlService } from "@src/utils/urlUtils";
import { RentGpusForm } from "@src/components/sdl/RentGpusForm";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.sdlBuilder()}`;

  return {
    title: "Rent GPUs",
    description: "Experience Global GPU Rental Excellence: Seamlessly Deploy AI Workloads with Docker Containers on Kubernetes",
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

export default function RentGpuPage() {
  return (
    <PageContainer>
      <Title>Rent GPUs</Title>

      <p className="mb-8 text-muted-foreground">
        Deploy any AI workload on a wide variety of Nvidia GPU models. Select from one of the available templates or input your own docker container image to
        deploy on one of the providers available worldwide on the network.
      </p>

      <RentGpusForm />
    </PageContainer>
  );
}
