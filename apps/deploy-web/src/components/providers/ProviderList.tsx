"use client";
import type { ChangeEventHandler } from "react";
import {
  Button,
  CheckboxWithLabel,
  CustomPagination,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner
} from "@akashnetwork/ui/components";
import { OpenNewWindow, Refresh, Xmark } from "iconoir-react";
import dynamic from "next/dynamic";

import networkStore from "@src/store/networkStore";
import { domainName, UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { CustomNextSeo } from "../shared/CustomNextSeo";
import { Title } from "../shared/Title";
import { ProviderMap } from "./ProviderMap";
import { ProviderTable } from "./ProviderTable";
import { useProviderListModel } from "./useProviderListModel";

const NetworkCapacity = dynamic(() => import("./NetworkCapacity/NetworkCapacity"), {
  ssr: false
});

export const ProviderList: React.FunctionComponent = () => {
  const model = useProviderListModel();
  const selectedNetwork = networkStore.useSelectedNetwork();

  const onSearchChange: ChangeEventHandler<HTMLInputElement> = event => {
    model.changeSearch(event.target.value);
  };

  return (
    <Layout isLoading={model.isLoading}>
      <CustomNextSeo title="Providers" url={`${domainName}${UrlService.providers()}`} description="Explore all the providers available on the Akash Network." />

      <Title>Network Capacity</Title>

      {model.locations && model.locations.length > 0 && (
        <h3 className="mb-8 text-base text-muted-foreground">
          <span className="text-2xl font-bold text-primary">{model.locations.length}</span> active providers on {selectedNetwork.title}
        </h3>
      )}

      {!model.hasLoadedProviders && model.isLoadingProviders && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="large" />
        </div>
      )}

      {model.locations && (
        <div className="mx-auto max-w-[800px]">
          <ProviderMap providers={model.locations} />
        </div>
      )}

      {model.networkCapacity && (
        <div className="mb-8">
          <NetworkCapacity stats={model.networkCapacity.resources} />
        </div>
      )}

      {model.hasLoadedProviders && (
        <>
          <div className="mr-4">
            <Button onClick={() => window.open("https://akash.network/providers/", "_blank")} size="sm" color="secondary" className="space-x-2">
              <OpenNewWindow className="text-xs" />
              <span className="whitespace-nowrap">Become a provider</span>
            </Button>
          </div>

          <div>
            <div className="flex flex-wrap items-center pt-4">
              <div className="flex items-center space-x-6">
                <h3 className="text-2xl">Providers</h3>

                <div>
                  <Button aria-label="back" onClick={model.refresh} size="icon" variant="ghost" className="rounded-full">
                    <Refresh />
                  </Button>
                </div>
              </div>

              <div className="my-2 flex items-center space-x-6 md:my-0 md:ml-8">
                <div>
                  <CheckboxWithLabel checked={model.isFilteringActive} onCheckedChange={model.changeIsFilteringActive} label="Active" />
                </div>
                <div>
                  <CheckboxWithLabel checked={model.isFilteringAudited} onCheckedChange={model.changeIsFilteringAudited} label="Audited" />
                </div>
                <div>
                  <CheckboxWithLabel checked={model.isFilteringFavorites} onCheckedChange={model.changeIsFilteringFavorites} label="Favorites" />
                </div>
              </div>
            </div>

            <div className="my-2 flex flex-col items-center space-y-2 md:flex-row md:space-x-2 md:space-y-0">
              <div className="flex-grow">
                <Input
                  value={model.search}
                  onChange={onSearchChange}
                  className="w-full"
                  label="Search Providers"
                  type="text"
                  endIcon={
                    !!model.search && (
                      <Button size="icon" variant="text" onClick={() => model.changeSearch("")}>
                        <Xmark />
                      </Button>
                    )
                  }
                />
              </div>

              <div className="w-full min-w-[200px] space-y-1 md:w-auto">
                <Label>Sort by</Label>
                <Select value={model.sort} onValueChange={model.changeSort}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lease" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {model.sortOptions.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          <span className="text-sm text-muted-foreground">{l.title}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ProviderTable providers={model.providers} sortOption={model.sort} />

            {model.providers.length === 0 && (
              <div className="p-4 text-center">
                <p>No provider found.</p>
              </div>
            )}

            <div className="flex items-center justify-center py-8">
              <CustomPagination
                pageSize={model.pageSize}
                setPageIndex={model.changePageIndex}
                pageIndex={model.pageIndex}
                totalPageCount={model.pageCount}
                setPageSize={model.changePageSize}
              />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};
