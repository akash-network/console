import React from "react";
import { Metadata } from "next";
import { PageContainer } from "@src/components/shared/PageContainer";
import { Title } from "@src/components/shared/Title";
import { SimpleSDLBuilderForm } from "@src/app/sdl-builder/SimpleSdlBuilderForm";
import { UrlService } from "@src/utils/urlUtils";

export async function generateMetadata(): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.sdlBuilder()}`;

  return {
    title: "SDL Builder",
    description: "Build your own SDL configuration to deploy a docker container on the Akash Network, the #1 decentralized supercloud.",
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

export default function SDLBuilderPage() {
  return (
    <PageContainer>
      <Title>SDL Builder</Title>

      <SimpleSDLBuilderForm />
    </PageContainer>
  );
}
