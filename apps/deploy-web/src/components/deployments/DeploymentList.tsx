"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  buttonVariants,
  CustomPagination,
  Input,
  Spinner,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Refresh, Rocket, Xmark } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { LinkTo } from "@src/components/shared/LinkTo";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useListSelection } from "@src/hooks/useListSelection/useListSelection";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";
import { useDeploymentsPage } from "@src/queries/useDeploymentQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import sdlStore from "@src/store/sdlStore";
import type { DeploymentStatus, NamedDeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { NoDeploymentsState } from "../home/NoDeploymentsState";
import Layout from "../layout/Layout";
import { Title } from "../shared/Title";
import { DeploymentListRow } from "./DeploymentListRow";

export const DEPENDENCIES = {
  useWallet,
  useProviderList,
  useSettings,
  useLocalNotes,
  useManagedDeploymentConfirm,
  useNewDeploymentUrl,
  useDeploymentsPage,
  Layout,
  NoDeploymentsState,
  DeploymentListRow
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentList: React.FunctionComponent<Props> = ({ dependencies = DEPENDENCIES }) => {
  const {
    useWallet,
    useProviderList,
    useSettings,
    useLocalNotes,
    useManagedDeploymentConfirm,
    useNewDeploymentUrl,
    useDeploymentsPage,
    Layout,
    NoDeploymentsState,
    DeploymentListRow
  } = dependencies;
  const { address, signAndBroadcastTx, hasWallet } = useWallet();
  const { data: providers, isFetching: isLoadingProviders } = useProviderList();
  const { settings, isSettingsInit } = useSettings();
  const { apiEndpoint } = settings;
  const { getDeploymentName } = useLocalNotes();
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>("active");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const newDeploymentUrl = useNewDeploymentUrl();

  const {
    data,
    isFetching: isLoadingDeployments,
    isError,
    refetch: getDeployments
  } = useDeploymentsPage(
    address,
    { state: deploymentStatus, skip: pageIndex * pageSize, limit: pageSize, countTotal: true },
    { enabled: isSettingsInit && !!address }
  );

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pageSize);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex > pageCount - 1) {
      setPageIndex(Math.max(pageCount - 1, 0));
    }
  }, [pageCount, pageIndex]);

  const pageDeployments = useMemo(() => {
    const named = (data?.deployments ?? []).map(d => ({ ...d, name: getDeploymentName(d.dseq) })) as NamedDeploymentDto[];
    if (!search) return named;
    const query = search.toLowerCase();
    return named.filter(d => d.name?.toLowerCase().includes(query) || d.dseq?.toLowerCase().includes(query));
  }, [data?.deployments, search, getDeploymentName]);

  const { selectedItemIds, selectItem, clearSelection } = useListSelection<string>({
    ids: pageDeployments.map(deployment => deployment.dseq)
  });

  useEffect(() => {
    if (isSettingsInit && address) {
      getDeployments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEndpoint]);

  const onStatusChange = (value: string) => {
    if (value !== "active" && value !== "closed") return;
    setDeploymentStatus(value);
    setPageIndex(0);
    clearSelection();
  };

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const onCloseSelectedDeployments = async () => {
    try {
      const isConfirmed = await closeDeploymentConfirm(selectedItemIds);

      if (!isConfirmed) {
        return;
      }

      const messages = selectedItemIds.map(dseq => TransactionMessageData.getCloseDeploymentMsg(address, `${dseq}`));
      const response = await signAndBroadcastTx(messages);
      if (response) {
        getDeployments();
        clearSelection();
      }
    } catch (error) {
      console.log(error);
    }
  };

  const onDeployClick = () => {
    setDeploySdl(null);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

  const isActiveStatus = deploymentStatus === "active";
  const showEmptyState = total === 0 && !isLoadingDeployments && !isError && !search;
  const showErrorState = isError && total === 0 && !isLoadingDeployments;

  return (
    <Layout isLoading={isLoadingDeployments || isLoadingProviders} isUsingSettings>
      <NextSeo title="Deployments" />
      {hasWallet && (
        <div className="flex flex-wrap items-center pb-6">
          <Title>Deployments</Title>

          <div className="ml-6">
            <Button aria-label="refresh" onClick={() => getDeployments()} size="icon" variant="ghost">
              <Refresh />
            </Button>
          </div>

          <div className="ml-6">
            <Tabs value={deploymentStatus} onValueChange={onStatusChange}>
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {selectedItemIds.length > 0 && (
            <>
              <div className="md:ml-6">
                <Button onClick={onCloseSelectedDeployments} color="secondary" size="sm">
                  Close selected ({selectedItemIds.length})
                </Button>
              </div>

              <div className="ml-6">
                <LinkTo onClick={clearSelection}>Clear</LinkTo>
              </div>
            </>
          )}

          {total > 0 && (
            <Link
              href={newDeploymentUrl()}
              className={cn("ml-auto space-x-2", buttonVariants({ variant: "default", size: "sm" }))}
              aria-disabled={settings.isBlockchainDown}
              onClick={onDeployClick}
            >
              <Rocket className="rotate-45 text-sm" />
              <span className="whitespace-nowrap">Deploy</span>
            </Link>
          )}
        </div>
      )}

      {(total > 0 || !!search) && (
        <div className="flex items-center pb-6">
          <div className="flex-grow">
            <Input
              value={search}
              onChange={onSearchChange}
              label="Search Deployments by name"
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
        </div>
      )}

      {showErrorState && (
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <p className="text-muted-foreground">Couldn't load deployments.</p>
          <Button variant="outline" size="sm" onClick={() => getDeployments()}>
            <Refresh className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {showEmptyState && isActiveStatus && <NoDeploymentsState onDeployClick={onDeployClick} hasDeployments={false} showTemplatesButton />}

      {showEmptyState && !isActiveStatus && (
        <div className="py-6">
          <p>No closed deployments.</p>
        </div>
      )}

      {total === 0 && isLoadingDeployments && !search && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
        </div>
      )}

      <div>
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between pb-6">
            <span className="text-xs">
              You have <strong>{total}</strong>
              {isActiveStatus ? " active" : " closed"} deployments
            </span>
          </div>
        )}

        {pageDeployments.length > 0 && (
          <Table className="min-w-[1024px] table-fixed">
            <colgroup>
              <col width="120" />
              <col />
              <col width="15%" />
              <col width="20%" />
              <col width="25%" />
              <col width="130px" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Specs</TableHead>
                <TableHead className="text-center">Name</TableHead>
                <TableHead className="text-center">DSEQ</TableHead>
                <TableHead className="text-center">Cost and balance</TableHead>
                <TableHead className="text-center">Leases</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageDeployments.map(deployment => (
                <DeploymentListRow
                  key={deployment.dseq}
                  deployment={deployment}
                  refreshDeployments={getDeployments}
                  providers={providers}
                  isSelectable={isActiveStatus}
                  onSelectDeployment={selectItem}
                  checked={selectedItemIds.includes(deployment.dseq)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {search && pageDeployments.length === 0 && (
        <div className="py-6">
          <p>No deployment found.</p>
        </div>
      )}

      {total > 0 && !search && (
        <div className="flex items-center justify-center py-8">
          <CustomPagination totalPageCount={pageCount} setPageIndex={setPageIndex} pageIndex={pageIndex} pageSize={pageSize} setPageSize={onPageSizeChange} />
        </div>
      )}
    </Layout>
  );
};
