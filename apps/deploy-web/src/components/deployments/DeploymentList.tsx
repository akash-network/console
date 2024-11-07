"use client";
import { useEffect, useState } from "react";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CheckboxWithLabel,
  CustomPagination,
  Input,
  Spinner,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Refresh, Rocket, Xmark } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { LinkTo } from "@src/components/shared/LinkTo";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useDeploymentList } from "@src/queries/useDeploymentQuery";
import { useProviderList } from "@src/queries/useProvidersQuery";
import sdlStore from "@src/store/sdlStore";
import walletStore from "@src/store/walletStore";
import { DeploymentDto, NamedDeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { Title } from "../shared/Title";
import { ConnectWalletButton } from "../wallet/ConnectWalletButton";
import { DeploymentListRow } from "./DeploymentListRow";

export const DeploymentList: React.FunctionComponent = () => {
  const { address, signAndBroadcastTx, isWalletLoaded, isWalletConnected } = useWallet();
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
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const [isSignedInWithTrial] = useAtom(walletStore.isSignedInWithTrial);
  const { user } = useCustomUser();

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
        filteredDeployments = filteredDeployments.filter(
          x => x.name?.toLowerCase().includes(search.toLowerCase()) || x.dseq?.toLowerCase().includes(search.toLowerCase())
        );
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
      const isConfirmed = await closeDeploymentConfirm(selectedDeploymentDseqs);

      if (!isConfirmed) {
        return;
      }

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
      {deployments && deployments.length > 0 && isWalletConnected && (
        <div className="flex flex-wrap items-center pb-2">
          <>
            <Title className="font-bold" subTitle>
              Deployments
            </Title>

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
        </div>
      )}

      {((filteredDeployments?.length || 0) > 0 || !!search) && (
        <div className="flex items-center pb-4 pt-2">
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

      {filteredDeployments?.length === 0 && !isLoadingDeployments && !search && (
        <Card>
          <CardContent>
            <div className="p-16 text-center">
              <h3 className="mb-2 text-xl font-bold">{deployments && deployments?.length > 0 ? "No active deployments." : "No deployments yet."}</h3>

              {isSignedInWithTrial && !user && <p className="text-sm">If you are expecting to see some, you may need to sign-in or connect a wallet</p>}

              {isWalletConnected ? (
                <Link href={UrlService.newDeployment()} className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-4")} onClick={onDeployClick}>
                  Deploy
                  <Rocket className="ml-4 rotate-45 text-sm" />
                </Link>
              ) : (
                <div className="mt-8 flex items-center justify-center space-x-2">
                  <ConnectWalletButton />
                  <Link className={cn(buttonVariants({ variant: "outline" }))} href={UrlService.login()}>
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(!filteredDeployments || filteredDeployments?.length === 0) && isLoadingDeployments && !search && (
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
        <div className="flex items-center justify-center py-8">
          <CustomPagination
            totalPageCount={pageCount}
            setPageIndex={handleChangePage}
            pageIndex={pageIndex}
            pageSize={pageSize}
            setPageSize={onPageSizeChange}
          />
        </div>
      )}
    </Layout>
  );
};
