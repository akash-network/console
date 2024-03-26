import { useEffect } from "react";
import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { useProviderAttributesSchema, useProviderDetail } from "@src/queries/useProvidersQuery";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import PageContainer from "@src/components/shared/PageContainer";
import { EditProviderForm } from "@src/app/providers/[owner]/edit/EditProviderForm";
import { getProviderNameFromUri } from "@src/utils/providerUtils";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  owner: string;
};

const ProviderEditPage: React.FunctionComponent<Props> = ({ owner }) => {
  const { data: provider, isLoading: isLoadingProvider, refetch: getProviderDetail } = useProviderDetail(owner, { enabled: false });
  const { data: providerAttributesSchema, isFetching: isLoadingSchema } = useProviderAttributesSchema();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => {
    getProviderDetail();
  };

  return (
    <Layout isLoading={isLoadingSchema || isLoadingProvider}>
      <NextSeo title={`Edit Provider ${owner}`} />

      <PageContainer>
        {provider && providerAttributesSchema && (
          <>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Button component={Link} href={UrlService.providerDetail(provider.owner)} replace startIcon={<ChevronLeftIcon />}>
                Back
              </Button>

              <Typography variant="h1" sx={{ fontSize: "1.5rem", marginLeft: "1.5rem" }}>
                Edit Provider <strong>{getProviderNameFromUri(provider.hostUri)}</strong>
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption">
                This form is based on the provider attribute schema established here&nbsp;
                <a target="_blank" href="https://github.com/akash-network/cloudmos/blob/main/config/provider-attributes.json" rel="noreferrer noopener">
                  on github.
                </a>
              </Typography>
            </Box>

            <Box sx={{ padding: "1rem 0" }}>
              <EditProviderForm provider={provider} providerAttributesSchema={providerAttributesSchema} />
            </Box>
          </>
        )}

        {(isLoadingSchema || isLoadingProvider) && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
            <CircularProgress size="4rem" color="secondary" />
          </Box>
        )}
      </PageContainer>
    </Layout>
  );
};

export default ProviderEditPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}
