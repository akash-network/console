import { useTheme } from "@mui/material/styles";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import PageContainer from "@src/components/shared/PageContainer";
import { Chip } from "@mui/material";
import { SimpleSDLBuilderForm } from "@src/components/sdl/SimpleSdlBuilderForm";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { UrlService } from "@src/utils/urlUtils";

type Props = {};

const SDLBuilderPage: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();

  return (
    <Layout>
      <CustomNextSeo
        title="SDL Builder"
        url={`https://deploy.cloudmos.io${UrlService.sdlBuilder()}`}
        description="Build your own SDL configuration to deploy a docker container on the Akash Network, the #1 decentralized supercloud."
      />

      <PageContainer>
        <Title
          value={
            <>
              SDL Builder <Chip label="Beta" sx={{ marginLeft: ".5rem" }} size="small" />
            </>
          }
        />

        <SimpleSDLBuilderForm />
      </PageContainer>
    </Layout>
  );
};

export default SDLBuilderPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
