"use client";
import { useEffect, useState } from "react";
import { Address, Button, Popup, Spinner, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { Bank } from "iconoir-react";
import { NextSeo } from "next-seo";

import { Fieldset } from "@src/components/shared/Fieldset";
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
import { AllowanceIssuedRow } from "./AllowanceIssuedRow";
import { AllowanceModal } from "./AllowanceModal";
import { GranteeRow } from "./GranteeRow";
import { GranterRow } from "./GranterRow";
import { GrantModal } from "./GrantModal";

type RefreshingType = "granterGrants" | "granteeGrants" | "allowancesIssued" | "allowancesGranted" | null;
const defaultRefetchInterval = 30 * 1000;
const refreshingInterval = 1000;

export const Authorizations: React.FunctionComponent = () => {
  const { address, signAndBroadcastTx } = useWallet();
  const [editingGrant, setEditingGrant] = useState<GrantType | null>(null);
  const [editingAllowance, setEditingAllowance] = useState<AllowanceType | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [deletingGrant, setDeletingGrant] = useState<GrantType | null>(null);
  const [deletingAllowance, setDeletingAllowance] = useState<AllowanceType | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<RefreshingType>(null);
  const { data: granterGrants, isLoading: isLoadingGranterGrants } = useGranterGrants(address, {
    refetchInterval: isRefreshing === "granterGrants" ? refreshingInterval : defaultRefetchInterval
  });
  const { data: granteeGrants, isLoading: isLoadingGranteeGrants } = useGranteeGrants(address, {
    refetchInterval: isRefreshing === "granteeGrants" ? refreshingInterval : defaultRefetchInterval
  });
  const { data: allowancesIssued, isLoading: isLoadingAllowancesIssued } = useAllowancesIssued(address, {
    refetchInterval: isRefreshing === "allowancesIssued" ? refreshingInterval : defaultRefetchInterval
  });
  const {
    fee: { all: allowancesGranted, isLoading: isLoadingAllowancesGranted, setDefault, default: defaultAllowance }
  } = useAllowance();

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

  async function onDeleteGrantConfirmed() {
    if (!deletingGrant) return;

    const message = TransactionMessageData.getRevokeMsg(address, deletingGrant.grantee, deletingGrant.authorization["@type"]);
    const response = await signAndBroadcastTx([message]);

    if (response) {
      setIsRefreshing("granterGrants");
      setDeletingGrant(null);
    }
  }

  async function onDeleteAllowanceConfirmed() {
    if (!deletingAllowance) return;

    const message = TransactionMessageData.getRevokeAllowanceMsg(address, deletingAllowance.grantee);
    const response = await signAndBroadcastTx([message]);

    if (response) {
      setIsRefreshing("allowancesIssued");
      setDeletingAllowance(null);
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grantee</TableHead>
                          <TableHead className="text-right">Spending Limit</TableHead>
                          <TableHead className="text-right">Expiration</TableHead>
                          <TableHead className="text-right"></TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {granterGrants.map(grant => (
                          <GranterRow key={grant.grantee} grant={grant} onEditGrant={onEditGrant} setDeletingGrant={setDeletingGrant} />
                        ))}
                      </TableBody>
                    </Table>
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Grantee</TableHead>
                          <TableHead className="text-right">Spending Limit</TableHead>
                          <TableHead className="text-right">Expiration</TableHead>
                          <TableHead className="text-right"></TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {allowancesIssued.map(allowance => (
                          <AllowanceIssuedRow
                            key={allowance.grantee}
                            allowance={allowance}
                            onEditAllowance={onEditAllowance}
                            setDeletingAllowance={setDeletingAllowance}
                          />
                        ))}
                      </TableBody>
                    </Table>
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

        {!!deletingGrant && (
          <Popup
            open={true}
            title="Confirm Delete?"
            variant="confirm"
            onClose={() => setDeletingGrant(null)}
            onCancel={() => setDeletingGrant(null)}
            onValidate={onDeleteGrantConfirmed}
            enableCloseOnBackdropClick
          >
            Deleting grant to{" "}
            <strong>
              <Address address={deletingGrant.grantee} />
            </strong>{" "}
            will revoke their ability to spend your funds on deployments.
          </Popup>
        )}
        {!!deletingAllowance && (
          <Popup
            open={true}
            title="Confirm Delete?"
            variant="confirm"
            onClose={() => setDeletingAllowance(null)}
            onCancel={() => setDeletingAllowance(null)}
            onValidate={onDeleteAllowanceConfirmed}
            enableCloseOnBackdropClick
          >
            Deleting allowance to{" "}
            <strong>
              <Address address={deletingAllowance.grantee} />
            </strong>{" "}
            will revoke their ability to fees on your behalf.
          </Popup>
        )}
        {showGrantModal && <GrantModal editingGrant={editingGrant} address={address} onClose={onGrantClose} />}
        {showAllowanceModal && <AllowanceModal editingAllowance={editingAllowance} address={address} onClose={onAllowanceClose} />}
      </SettingsLayout>
    </Layout>
  );
};
