"use client";
import { useEffect } from "react";
import Layout from "@src/components/layout/Layout";
import { useProviderAttributesSchema, useProviderDetail } from "@src/queries/useProvidersQuery";
import { getProviderNameFromUri } from "@src/utils/providerUtils";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { PageContainer } from "@src/components/shared/PageContainer";

type Props = {
  owner: string;
};

export const EditProviderContainer: React.FunctionComponent<Props> = ({ owner }) => {
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
