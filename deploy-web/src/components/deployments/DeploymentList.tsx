"use client";
import { NextSeo } from "next-seo";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useEffect, useState } from "react";
import { useSettings } from "@src/context/SettingsProvider";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { LinkTo } from "@src/components/shared/LinkTo";
import { useAtom } from "jotai";
import sdlStore from "@src/store/sdlStore";
import { useProviderList } from "@src/queries/useProvidersQuery";
import { DeploymentDto, NamedDeploymentDto } from "@src/types/deployment";
import { PageContainer } from "@src/components/shared/PageContainer";
import { Button, buttonVariants } from "@src/components/ui/button";
import { Refresh, Rocket, Xmark } from "iconoir-react";
import { Checkbox, CheckboxWithLabel } from "@src/components/ui/checkbox";
import { cn } from "@src/utils/styleUtils";
import { InputWithIcon } from "@src/components/ui/input";
import { IconButton } from "@mui/material";
import Spinner from "@src/components/shared/Spinner";
import { CustomPagination } from "@src/components/shared/CustomPagination";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@src/components/ui/table";
import Layout from "../layout/Layout";
import { DeploymentListRow } from "./DeploymentListRow";

type Props = {};

export const DeploymentList: React.FunctionComponent<Props> = ({}) => {
  const { address, signAndBroadcastTx, isWalletLoaded } = useWallet();
  const { data: providers, isFetching: isLoadingProviders } = useProviderList();
  const { data: deployments, isFetching: isLoadingDeployments, refetch: getDeployments } = useDeploymentList(address, { enabled: false });
  const [pageIndex, setPageIndex] = useState(0);
  const { settings, isSettingsInit } = useSettings();
  const [search, setSearch] = useState("");
  const { getDeploymentName } = useLocalNotes();
  const [filteredDeployments, setFilteredDeployments] = useState<NamedDeploymentDto[] | null>(null);
  const [isFilteringActive, setIsFilteringActive] = useState(true);
  const [selectedDeploymentDseqs, setSelectedDeploymentDseqs] = useState<string[]>([]);
  const { apiEndpoint } = settings;
  const [pageSize, setPageSize] = useState<number>(10);
  const orderedDeployments = filteredDeployments
    ? [...filteredDeployments].sort((a: DeploymentDto, b: DeploymentDto) => (a.createdAt < b.createdAt ? 1 : -1))
    : [];
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const currentPageDeployments = orderedDeployments.slice(start, end);
  const pageCount = Math.ceil(orderedDeployments.length / pageSize);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);

  useEffect(() => {
    if (isWalletLoaded && isSettingsInit) {
      getDeployments();
    }
  }, [isWalletLoaded, isSettingsInit, getDeployments, apiEndpoint, address]);

  useEffect(() => {
    if (deployments) {
      let filteredDeployments = deployments.map(d => {
        const name = getDeploymentName(d.dseq);

        return {
          ...d,
          name
        };
      }) as NamedDeploymentDto[];

      // Filter for search
      if (search) {
        filteredDeployments = filteredDeployments.filter(x => x.name?.toLowerCase().includes(search.toLowerCase()));
      }

      if (isFilteringActive) {
        filteredDeployments = filteredDeployments.filter(d => d.state === "active");
      }

      setFilteredDeployments(filteredDeployments);
    }
  }, [deployments, search, getDeploymentName, isFilteringActive]);

  const handleChangePage = newPage => {
    setPageIndex(newPage);
  };

  const onIsFilteringActiveClick = value => {
    setPageIndex(0);
    setIsFilteringActive(value);
  };

  const onSearchChange = event => {
    const value = event.target.value;
    setSearch(value);
  };

  const onSelectDeployment = (checked, dseq) => {
    setSelectedDeploymentDseqs(prev => {
      return checked ? prev.concat([dseq]) : prev.filter(x => x !== dseq);
    });
  };

  const onCloseSelectedDeployments = async () => {
    try {
      const messages = selectedDeploymentDseqs.map(dseq => TransactionMessageData.getCloseDeploymentMsg(address, `${dseq}`));
      const response = await signAndBroadcastTx(messages);
      if (response) {
        getDeployments();
        setSelectedDeploymentDseqs([]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const onClearSelection = () => {
    setSelectedDeploymentDseqs([]);
  };

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

  return (
    <Layout isLoading={isLoadingDeployments || isLoadingProviders} isUsingSettings isUsingWallet>
      <NextSeo title="Deployments" />

      <PageContainer>
        <div className="flex flex-wrap items-center pb-2">
          <h3 className="text-2xl font-bold">Deployments</h3>

          {deployments && (
            <>
              <div className="ml-4">
                <Button aria-label="back" onClick={() => getDeployments()} size="icon" variant="ghost">
                  <Refresh />
                </Button>
              </div>

              <div className="ml-8">
                <div className="flex items-center space-x-2">
                  <CheckboxWithLabel label="Active" checked={isFilteringActive} onCheckedChange={onIsFilteringActiveClick} />
                </div>
              </div>

              {selectedDeploymentDseqs.length > 0 && (
                <>
                  <div className="md:ml-4">
                    <Button onClick={onCloseSelectedDeployments} color="secondary">
                      Close selected ({selectedDeploymentDseqs.length})
                    </Button>
                  </div>

                  <div className="ml-4">
                    <LinkTo onClick={onClearSelection}>Clear</LinkTo>
                  </div>
                </>
              )}

              {(filteredDeployments?.length || 0) > 0 && (
                <Link href={UrlService.newDeployment()} className={cn("ml-auto", buttonVariants({ variant: "default", size: "sm" }))} onClick={onDeployClick}>
                  Deploy
                  <Rocket className="ml-4 rotate-45 text-sm" />
                </Link>
              )}
            </>
          )}
        </div>

        {(filteredDeployments?.length || 0) > 0 && (
          <div className="flex items-center pb-4 pt-2">
            <InputWithIcon
              label="Search Deployments by name"
              value={search}
              onChange={onSearchChange}
              className="w-full"
              type="text"
              endIcon={
                !!search && (
                  <Button size="icon" variant="text" onClick={() => setSearch("")}>
                    <Xmark className="text-xs" />
                  </Button>
                )
              }
            />
          </div>
        )}

        {filteredDeployments?.length === 0 && !isLoadingDeployments && !search && (
          <div className="p-16 text-center">
            <h5 className="font-normal">{isFilteringActive ? "No active deployments" : "No deployments"}</h5>

            <Link href={UrlService.newDeployment()} className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-4")} onClick={onDeployClick}>
              Deploy
              <Rocket className="ml-4 rotate-45 text-sm" />
            </Link>
          </div>
        )}

        {(!filteredDeployments || filteredDeployments?.length === 0) && isLoadingDeployments && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        <div>
          {orderedDeployments.length > 0 && (
            <div className="flex flex-wrap items-center justify-between pb-4">
              <span className="text-xs">
                You have <strong>{orderedDeployments.length}</strong>
                {isFilteringActive ? " active" : ""} deployments
              </span>
            </div>
          )}

          {currentPageDeployments?.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[10%] text-center">Specs</TableHead>
                  <TableHead className="w-[20%] text-center">Name</TableHead>
                  <TableHead className="w-[10%] text-center">Time left</TableHead>
                  <TableHead className="w-[10%] text-center">Balance</TableHead>
                  <TableHead className="w-[15%] text-center">Cost</TableHead>
                  <TableHead className="w-[15%] text-center">Leases</TableHead>
                  <TableHead className="w-[10%]"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {currentPageDeployments.map(deployment => (
                  <DeploymentListRow
                    key={deployment.dseq}
                    deployment={deployment}
                    refreshDeployments={getDeployments}
                    providers={providers}
                    isSelectable
                    onSelectDeployment={onSelectDeployment}
                    checked={selectedDeploymentDseqs.some(x => x === deployment.dseq)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {search && currentPageDeployments.length === 0 && (
          <div className="py-4">
            <p>No deployment found.</p>
          </div>
        )}

        {(filteredDeployments?.length || 0) > 0 && (
          <div className="flex items-center justify-center pb-8 pt-4">
            <CustomPagination
              totalPageCount={pageCount}
              setPageIndex={handleChangePage}
              pageIndex={pageIndex}
              pageSize={pageSize}
              setPageSize={onPageSizeChange}
            />
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
