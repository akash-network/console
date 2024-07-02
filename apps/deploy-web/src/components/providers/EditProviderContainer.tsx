"use client";
import { useEffect } from "react";
import { buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { useProviderAttributesSchema, useProviderDetail } from "@src/queries/useProvidersQuery";
import { getProviderNameFromUri } from "@src/utils/providerUtils";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { EditProviderForm } from "./EditProviderForm";

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
      <NextSeo title={`Edit Provider ${owner}`} />

      {provider && providerAttributesSchema && (
        <>
          <div className="flex items-center">
            <Link className={cn(buttonVariants({ variant: "ghost" }), "flex items-center")} href={UrlService.providerDetail(provider.owner)} replace>
              <NavArrowLeft />
              Back
            </Link>

            <h1 className="ml-6 text-2xl">
              Edit Provider <strong>{getProviderNameFromUri(provider.hostUri)}</strong>
            </h1>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              This form is based on the provider attribute schema established here&nbsp;
              <a target="_blank" href="https://github.com/akash-network/console/blob/main/config/provider-attributes.json" rel="noreferrer noopener">
                on github.
              </a>
            </p>
          </div>

          <div className="py-4">
            <EditProviderForm provider={provider} providerAttributesSchema={providerAttributesSchema} />
          </div>
        </>
      )}

      {(isLoadingSchema || isLoadingProvider) && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
        </div>
      )}
    </Layout>
  );
};
