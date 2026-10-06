"use client";
import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { useIsFetching } from "@tanstack/react-query";
import { Server } from "lucide-react";

import Layout from "@src/components/layout/Layout";
import { ProvidersExplorer } from "@src/components/providers/ProvidersExplorer/ProvidersExplorer";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { QueryKeys } from "@src/queries/queryKeys";
import { domainName, UrlService } from "@src/utils/urlUtils";

const BECOME_A_PROVIDER_URL = "https://akash.network/docs/providers/setup-and-installation/provider-playbook/";

export const DEPENDENCIES = { Layout, CustomNextSeo, ProvidersExplorer, useIsFetching };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ProvidersPage: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const isSearchingProviders = d.useIsFetching({ queryKey: QueryKeys.getAllProviderSearchesKey() }) > 0;

  return (
    <d.Layout isLoading={isSearchingProviders} disableContainer>
      <d.CustomNextSeo
        title="Providers"
        url={`${domainName}${UrlService.providers()}`}
        description="Explore all the providers available on the Akash Network."
      />

      <div className="flex h-[calc(100dvh_-_var(--app-header-height,57px)_-_4px)] flex-col">
        <div className="flex min-h-[60px] shrink-0 items-center border-b bg-background">
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 md:px-6">
            <h1 className="whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.02em]">Providers</h1>
            <span className="flex-1" />
            <Button asChild variant="outline" size="sm" className="gap-1.5 shadow-sm">
              <a href={BECOME_A_PROVIDER_URL} target="_blank" rel="noopener noreferrer">
                <Server className="h-3.5 w-3.5" aria-hidden />
                Become a provider
              </a>
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px]">
            <d.ProvidersExplorer />
          </div>
        </div>
      </div>
    </d.Layout>
  );
};
