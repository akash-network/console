import { useTheme } from "@mui/material/styles";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import PageContainer from "@src/components/shared/PageContainer";
import { Chip } from "@mui/material";
// import { SimpleSDLBuilderForm } from "@src/components/sdl/SimpleSdlBuilderForm";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import React from "react";
import { UrlService } from "@src/utils/urlUtils";
import { RentGpusForm } from "@src/components/sdl/RentGpusForm";

type Props = {};

const RentGpuPage: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();

  return (
    <Layout>
      <CustomNextSeo
        title="Rent GPUs"
        url={`https://deploy.cloudmos.io${UrlService.sdlBuilder()}`}
        description="Rent GPUs for your deep learning projects on the Akash Network."
      />

      <PageContainer>
        <Title value={<>Rent GPUs</>} />

        <RentGpusForm />
        {/* <SimpleSDLBuilderForm /> */}
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
