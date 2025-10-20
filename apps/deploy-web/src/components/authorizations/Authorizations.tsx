"use client";
import { useEffect, useState } from "react";
import React from "react";
import { Button, Input, Popup, Spinner, Table, TableBody, TableHead, TableHeader, TableRow, useDebounce } from "@akashnetwork/ui/components";
import { Bank, Refresh, Xmark } from "iconoir-react";
import { NextSeo } from "next-seo";

import { Fieldset } from "@src/components/shared/Fieldset";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAllowance } from "@src/hooks/useAllowance";
import { useExactDeploymentGrantsQuery } from "@src/queries/useExactDeploymentGrantsQuery";
import { useAllowancesIssued, useGranteeGrants, useGranterGrants } from "@src/queries/useGrantsQuery";
import type { AllowanceType, GrantType, PaginatedAllowanceType, PaginatedGrantType } from "@src/types/grant";
import { isValidBech32Address } from "@src/utils/address";
import { averageBlockTime } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import Layout from "../layout/Layout";
import { SettingsLayout, SettingsTabs } from "../settings/SettingsLayout";
import { ConnectWallet } from "../shared/ConnectWallet";
import { Title } from "../shared/Title";
import { AllowanceGrantedRow } from "./AllowanceGrantedRow";
import { AllowanceModal } from "./AllowanceModal";
import { DeploymentGrantTable } from "./DeploymentGrantTable";
import { FeeGrantTable } from "./FeeGrantTable";
import { GranteeRow } from "./GranteeRow";
import { GrantModal } from "./GrantModal";

type RefreshingType = "granterGrants" | "granteeGrants" | "allowancesIssued" | "allowancesGranted" | null;
const defaultRefetchInterval = 30 * 1000;
const refreshingInterval = 1000;

const MASTER_WALLETS = new Set([
  browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS,
  browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS
]);

const selectNonMasterGrants = (data: PaginatedGrantType) => ({
  ...data,
  grants: data.grants.filter(({ grantee }) => !MASTER_WALLETS.has(grantee))
});

const selectNonMasterAllowances = (data: PaginatedAllowanceType) => ({
  ...data,
  allowances: data.allowances.filter(({ grantee }) => !MASTER_WALLETS.has(grantee))
});

export const Authorizations: React.FunctionComponent = () => {
  const { settings } = useSettings();
  const { address, signAndBroadcastTx, isManaged } = useWallet();
  const {
    fee: { all: allowancesGranted, isLoading: isLoadingAllowancesGranted, setDefault, default: defaultAllowance }
  } = useAllowance(address, isManaged);
  const [editingGrant, setEditingGrant] = useState<GrantType | null>(null);
  const [editingAllowance, setEditingAllowance] = useState<AllowanceType | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [deletingGrants, setDeletingGrants] = useState<GrantType[] | null>(null);
  const [deletingAllowances, setDeletingAllowances] = useState<AllowanceType[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<RefreshingType>(null);
  const [selectedGrants, setSelectedGrants] = useState<GrantType[]>([]);
  const [selectedAllowances, setSelectedAllowances] = useState<AllowanceType[]>([]);
  const [searchGrantee, setSearchGrantee] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState({ deployment: 0, fee: 0 });
  const [pageSize, setPageSize] = useState({ deployment: 10, fee: 10 });
  const debouncedSearchGrantee = useDebounce(searchGrantee, 500);
  const { data: granterGrants, isLoading: isLoadingGranterGrants } = useGranterGrants(address, pageIndex.deployment, pageSize.deployment, {
    refetchInterval: isRefreshing === "granterGrants" ? refreshingInterval : defaultRefetchInterval,
    select: selectNonMasterGrants,
    enabled: !debouncedSearchGrantee
  });
  const { data: granteeGrants, isLoading: isLoadingGranteeGrants } = useGranteeGrants(address, {
    refetchInterval: isRefreshing === "granteeGrants" ? refreshingInterval : defaultRefetchInterval
  });
  const { data: allowancesIssued, isLoading: isLoadingAllowancesIssued } = useAllowancesIssued(address, pageIndex.fee, pageSize.fee, {
    refetchInterval: isRefreshing === "allowancesIssued" ? refreshingInterval : defaultRefetchInterval,
    select: selectNonMasterAllowances
  });
  const {
    data: specificGranteeGrants,
    isLoading: isLoadingGranterGranteeGrants,
    refetch: refetchGranterGranteeGrants
  } = useExactDeploymentGrantsQuery(address, searchGrantee, {
    enabled: false
  });
  const filteredGranterGrants =
    !!debouncedSearchGrantee && !!specificGranteeGrants ? { grants: [specificGranteeGrants], pagination: { total: 1 } } : granterGrants;
  const isLoading =
    !!isRefreshing ||
    isLoadingAllowancesIssued ||
    isLoadingAllowancesGranted ||
    isLoadingGranteeGrants ||
    isLoadingGranterGrants ||
    isLoadingGranterGranteeGrants;

  console.log("isLoadingAllowancesGranted", isLoadingAllowancesGranted);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isRefreshing) {
      timeout = setTimeout(() => {
        setIsRefreshing(null);
      }, averageBlockTime * 1000);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isRefreshing]);

  useEffect(() => {
    if (debouncedSearchGrantee && !searchError) {
      refetchGranterGranteeGrants();
    }
  }, [debouncedSearchGrantee, searchError, refetchGranterGranteeGrants]);

  async function onDeleteGrantsConfirmed() {
    if (!deletingGrants) return;

    const messages = deletingGrants.map(grant => TransactionMessageData.getRevokeDepositMsg(address, grant.grantee));
    const response = await signAndBroadcastTx(messages);

    if (response) {
      setIsRefreshing("granterGrants");
      setDeletingGrants(null);
      setSelectedGrants([]);
    }
  }

  async function onDeleteAllowanceConfirmed() {
    if (!deletingAllowances) return;

    const messages = deletingAllowances.map(allowance => TransactionMessageData.getRevokeAllowanceMsg(address, allowance.grantee));
    const response = await signAndBroadcastTx(messages);

    if (response) {
      setIsRefreshing("allowancesIssued");
      setDeletingAllowances(null);
      setSelectedAllowances([]);
    }
  }

  function onCreateNewGrant() {
    setEditingGrant(null);
    setShowGrantModal(true);
  }

  function onEditGrant(grant: GrantType) {
    setEditingGrant(grant);
    setShowGrantModal(true);
  }

  function onGrantClose() {
    setIsRefreshing("granterGrants");
    setShowGrantModal(false);
  }

  function onCreateNewAllowance() {
    setEditingAllowance(null);
    setShowAllowanceModal(true);
  }

  function onAllowanceClose() {
    setIsRefreshing("allowancesIssued");
    setShowAllowanceModal(false);
  }

  function onEditAllowance(allowance: AllowanceType) {
    setEditingAllowance(allowance);
    setShowAllowanceModal(true);
  }

  function onSearchGranteeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value?.trim();
    setSearchGrantee(value);

    if (!value) {
      setSearchError(null);
      return;
    }

    if (!isValidBech32Address(value, "akash")) {
      setSearchError("Invalid Akash address");
      return;
    }

    setSearchError(null);
  }

  function onAllowancePageChange(newPageIndex: number, newPageSize: number) {
    setPageIndex(prev => ({ ...prev, fee: newPageIndex }));
    setPageSize(prev => ({ ...prev, fee: newPageSize }));
  }

  function onDeploymentPageChange(newPageIndex: number, newPageSize: number) {
    setPageIndex(prev => ({ ...prev, deployment: newPageIndex }));
    setPageSize(prev => ({ ...prev, deployment: newPageSize }));
  }

  function onRefreshSearchClick() {
    if (!searchError && debouncedSearchGrantee) {
      refetchGranterGranteeGrants();
    }
  }

  return (
    <Layout isLoading={isLoading}>
      <NextSeo title="Settings Authorizations" />

      {settings.isBlockchainDown ? (
        <SettingsLayout title="" page={SettingsTabs.AUTHORIZATIONS}>
          <>
            <h3 className="mb-4 text-muted-foreground">The blockchain is unavailable. Unable to create, list, or update authorizations.</h3>
          </>
        </SettingsLayout>
      ) : (
        <>
          <SettingsLayout
            title="Deployment Authorizations"
            page={SettingsTabs.AUTHORIZATIONS}
            headerActions={
              address && (
                <div className="md:ml-4">
                  <Button onClick={onCreateNewGrant} color="secondary" variant="default" type="button" size="sm">
                    <Bank />
                    &nbsp;Authorize Spend
                  </Button>
                </div>
              )
            }
          >
            {!address ? (
              <>
                <Fieldset label="" className="mb-4">
                  <ConnectWallet text="Connect your wallet to create a deployment authorization." />
                </Fieldset>
              </>
            ) : (
              <>
                <h3 className="mb-4 text-muted-foreground">
                  These authorizations allow you authorize other addresses to spend on deployments or deployment deposits using your funds. You can revoke these
                  authorizations at any time.
                </h3>
                <Fieldset label="Authorizations Given" className="mb-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Search by grantee address..."
                      value={searchGrantee}
                      onChange={onSearchGranteeChange}
                      className="max-w-md flex-grow"
                      error={!!searchError}
                      endIcon={
                        <Button
                          variant="text"
                          size="icon"
                          onClick={() => {
                            setSearchGrantee("");
                            setSearchError(null);
                          }}
                        >
                          <Xmark />
                        </Button>
                      }
                    />
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={onRefreshSearchClick}>
                      <Refresh className="text-xs" />
                    </Button>
                  </div>
                  {isLoadingGranterGrants || !filteredGranterGrants ? (
                    <div className="flex items-center justify-center">
                      <Spinner size="large" />
                    </div>
                  ) : (
                    <>
                      {filteredGranterGrants?.grants?.length > 0 ? (
                        <DeploymentGrantTable
                          grants={filteredGranterGrants.grants}
                          totalCount={filteredGranterGrants?.pagination?.total || 0}
                          selectedGrants={selectedGrants}
                          onEditGrant={onEditGrant}
                          onPageChange={onDeploymentPageChange}
                          setDeletingGrants={setDeletingGrants}
                          setSelectedGrants={setSelectedGrants}
                          pageIndex={pageIndex.deployment}
                          pageSize={pageSize.deployment}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {searchGrantee
                            ? searchError
                              ? "Please enter a valid Akash address"
                              : "No matching authorizations found."
                            : "No authorizations given."}
                        </p>
                      )}
                    </>
                  )}
                </Fieldset>

                <Fieldset label="Authorizations Received" className="mb-4">
                  {isLoadingGranteeGrants || !granteeGrants ? (
                    <div className="flex items-center justify-center">
                      <Spinner size="large" />
                    </div>
                  ) : (
                    <>
                      {granteeGrants.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Granter</TableHead>
                              <TableHead className="text-right">Spending Limit</TableHead>
                              <TableHead className="text-right">Expiration</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {granteeGrants.map(grant => (
                              <GranteeRow key={grant.granter} grant={grant} />
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">No authorizations received.</p>
                      )}
                    </>
                  )}
                </Fieldset>
              </>
            )}

            <div className="flex flex-wrap items-center py-4">
              <Title>Tx Fee Authorizations</Title>
              {address && (
                <Button onClick={onCreateNewAllowance} color="secondary" variant="default" className="md:ml-4" type="button" size="sm">
                  <Bank />
                  &nbsp;Authorize Fee Spend
                </Button>
              )}
            </div>

            {!address ? (
              <>
                <Fieldset label="" className="mb-4">
                  <ConnectWallet text="Connect your wallet to create a tx fee authorization." />
                </Fieldset>
              </>
            ) : (
              <>
                <h3 className="mb-4 text-muted-foreground">
                  These authorizations allow you authorize other addresses to spend on transaction fees using your funds. You can revoke these authorizations at
                  any time.
                </h3>

                <Fieldset label="Authorizations Given" className="mb-4">
                  {isLoadingAllowancesIssued || !allowancesIssued ? (
                    <div className="flex items-center justify-center">
                      <Spinner size="large" />
                    </div>
                  ) : (
                    <>
                      {allowancesIssued.allowances.length > 0 ? (
                        <FeeGrantTable
                          allowances={allowancesIssued.allowances}
                          selectedAllowances={selectedAllowances}
                          onEditAllowance={onEditAllowance}
                          setDeletingAllowances={setDeletingAllowances}
                          setSelectedAllowances={setSelectedAllowances}
                          pageIndex={pageIndex.fee}
                          pageSize={pageSize.fee}
                          onPageChange={onAllowancePageChange}
                          totalCount={allowancesIssued.pagination?.total || 0}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">No allowances issued.</p>
                      )}
                    </>
                  )}
                </Fieldset>

                <Fieldset label="Authorizations Received" className="mb-4">
                  {isLoadingAllowancesGranted || !allowancesGranted ? (
                    <div className="flex items-center justify-center">
                      <Spinner size="large" />
                    </div>
                  ) : (
                    <>
                      {allowancesGranted.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Default</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Grantee</TableHead>
                              <TableHead>Spending Limit</TableHead>
                              <TableHead className="text-right">Expiration</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {!!allowancesGranted && (
                              <AllowanceGrantedRow
                                key={address}
                                allowance={{
                                  granter: "",
                                  grantee: "",
                                  allowance: { "@type": "$CONNECTED_WALLET", expiration: "", spend_limit: [] }
                                }}
                                onSelect={() => setDefault(undefined)}
                                selected={!defaultAllowance}
                              />
                            )}
                            {allowancesGranted.map(allowance => (
                              <AllowanceGrantedRow
                                key={allowance.granter}
                                allowance={allowance}
                                onSelect={() => setDefault(allowance.granter)}
                                selected={defaultAllowance === allowance.granter}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">No allowances received.</p>
                      )}
                    </>
                  )}
                </Fieldset>
              </>
            )}

            {!!deletingGrants && (
              <Popup
                open={true}
                title="Confirm Delete?"
                variant="confirm"
                onClose={() => setDeletingGrants(null)}
                onCancel={() => setDeletingGrants(null)}
                onValidate={onDeleteGrantsConfirmed}
                enableCloseOnBackdropClick
              >
                Deleting grants will revoke their ability to spend your funds on deployments.
              </Popup>
            )}
            {!!deletingAllowances && (
              <Popup
                open={true}
                title="Confirm Delete?"
                variant="confirm"
                onClose={() => setDeletingAllowances(null)}
                onCancel={() => setDeletingAllowances(null)}
                onValidate={onDeleteAllowanceConfirmed}
                enableCloseOnBackdropClick
              >
                Deleting allowance to will revoke their ability to fees on your behalf.
              </Popup>
            )}
            {showGrantModal && <GrantModal editingGrant={editingGrant} address={address} onClose={onGrantClose} />}
            {showAllowanceModal && <AllowanceModal editingAllowance={editingAllowance} address={address} onClose={onAllowanceClose} />}
          </SettingsLayout>
        </>
      )}
    </Layout>
  );
};
