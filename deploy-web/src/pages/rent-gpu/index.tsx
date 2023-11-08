import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import PageContainer from "@src/components/shared/PageContainer";
import { Typography } from "@mui/material";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import React from "react";
import { UrlService } from "@src/utils/urlUtils";
import { RentGpusForm } from "@src/components/sdl/RentGpusForm";

type Props = {};

const RentGpuPage: React.FunctionComponent<Props> = ({}) => {
  return (
    <Layout>
      <CustomNextSeo
        title="Rent GPUs"
        url={`https://deploy.cloudmos.io${UrlService.sdlBuilder()}`}
        description="Experience Global GPU Rental Excellence: Seamlessly Deploy AI Workloads with Docker Containers on Kubernetes"
      />

      <PageContainer>
        <Title value={<>Rent GPUs</>} />

        <Typography variant="body1" color="textSecondary" sx={{ marginBottom: "2rem" }}>
          Deploy any AI workload on a wide variety of Nvidia GPU models. Select from one of the available templates or input your own docker container image to
          deploy on one of the providers available worldwide on the network.
        </Typography>

        <RentGpusForm />
      </PageContainer>
    </Layout>
  );
};

export default RentGpuPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
