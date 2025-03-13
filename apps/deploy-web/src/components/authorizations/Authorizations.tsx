"use client";
import { useEffect, useState } from "react";
import { Button, Popup, Spinner, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Bank } from "iconoir-react";
import { NextSeo } from "next-seo";

import { Fieldset } from "@src/components/shared/Fieldset";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";
import { useAllowance } from "@src/hooks/useAllowance";
import { useAllowancesIssued, useGranteeGrants, useGranterGrants } from "@src/queries/useGrantsQuery";
import { AllowanceType, GrantType } from "@src/types/grant";
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

const selectNonMaster = (records: Pick<GrantType, "grantee">[] | Pick<AllowanceType, "grantee">[]) =>
  records.filter(({ grantee }) => !MASTER_WALLETS.has(grantee));

export const Authorizations: React.FunctionComponent = () => {
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
  const { data: granterGrants, isLoading: isLoadingGranterGrants } = useGranterGrants(address, {
    refetchInterval: isRefreshing === "granterGrants" ? refreshingInterval : defaultRefetchInterval,
    select: selectNonMaster
  });
  const { data: granteeGrants, isLoading: isLoadingGranteeGrants } = useGranteeGrants(address, {
    refetchInterval: isRefreshing === "granteeGrants" ? refreshingInterval : defaultRefetchInterval,
    enabled: true
  });
  const { data: allowancesIssued, isLoading: isLoadingAllowancesIssued } = useAllowancesIssued(address, {
    refetchInterval: isRefreshing === "allowancesIssued" ? refreshingInterval : defaultRefetchInterval,
    select: selectNonMaster
  });

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

  async function onDeleteGrantsConfirmed() {
    if (!deletingGrants) return;

    const messages = deletingGrants.map(grant => TransactionMessageData.getRevokeMsg(address, grant.grantee, grant.authorization["@type"]));
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

  return (
    <Layout isLoading={!!isRefreshing || isLoadingAllowancesIssued || isLoadingAllowancesGranted || isLoadingGranteeGrants || isLoadingGranterGrants}>
      <NextSeo title="Settings Authorizations" />

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
              {isLoadingGranterGrants || !granterGrants ? (
                <div className="flex items-center justify-center">
                  <Spinner size="large" />
                </div>
              ) : (
                <>
                  {granterGrants.length > 0 ? (
                    <DeploymentGrantTable
                      grants={granterGrants}
                      selectedGrants={selectedGrants}
                      onEditGrant={onEditGrant}
                      setDeletingGrants={setDeletingGrants}
                      setSelectedGrants={setSelectedGrants}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No authorizations given.</p>
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
              These authorizations allow you authorize other addresses to spend on transaction fees using your funds. You can revoke these authorizations at any
              time.
            </h3>

            <Fieldset label="Authorizations Given" className="mb-4">
              {isLoadingAllowancesIssued || !allowancesIssued ? (
                <div className="flex items-center justify-center">
                  <Spinner size="large" />
                </div>
              ) : (
                <>
                  {allowancesIssued.length > 0 ? (
                    <FeeGrantTable
                      allowances={allowancesIssued}
                      selectedAllowances={selectedAllowances}
                      onEditAllowance={onEditAllowance}
                      setDeletingAllowances={setDeletingAllowances}
                      setSelectedAllowances={setSelectedAllowances}
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
    </Layout>
  );
};
