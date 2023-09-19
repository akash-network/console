import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import PageContainer from "@src/components/shared/PageContainer";
import SettingsLayout, { SettingsTabs } from "@src/components/settings/SettingsLayout";
import { Fieldset } from "@src/components/shared/Fieldset";
import { Box, Button, CircularProgress, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { CustomTableHeader } from "@src/components/shared/CustomTable";
import { Address } from "@src/components/shared/Address";
import { GrantModal } from "@src/components/wallet/GrantModal";
import { AllowanceType, GrantType } from "@src/types/grant";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useAllowancesGranted, useAllowancesIssued, useGranteeGrants, useGranterGrants } from "@src/queries/useGrantsQuery";
import { Popup } from "@src/components/shared/Popup";
import { GranterRow } from "@src/components/settings/GranterRow";
import { GranteeRow } from "@src/components/settings/GranteeRow";
import { AllowanceModal } from "@src/components/wallet/AllowanceModal";
import { AllowanceIssuedRow } from "@src/components/settings/AllowanceIssuedRow";
import { makeStyles } from "tss-react/mui";
import { averageBlockTime } from "@src/utils/priceUtils";
import { AllowanceGrantedRow } from "@src/components/settings/AllowanceGrantedRow";

type Props = {};

const useStyles = makeStyles()(theme => ({
  subTitle: {
    fontSize: "1rem",
    color: theme.palette.text.secondary,
    marginBottom: "1rem"
  }
}));

type RefreshingType = "granterGrants" | "granteeGrants" | "allowancesIssued" | "allowancesGranted" | null;
const defaultRefetchInterval = 30 * 1000;
const refreshingInterval = 1000;

const SettingsSecurityPage: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const { address } = useKeplr();
  const [editingGrant, setEditingGrant] = useState(null);
  const [editingAllowance, setEditingAllowance] = useState(null);
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
  const { data: allowancesGranted, isLoading: isLoadingAllowancesGranted } = useAllowancesGranted(address, {
    refetchInterval: isRefreshing === "allowancesGranted" ? refreshingInterval : defaultRefetchInterval
  });
  const { signAndBroadcastTx } = useKeplr();

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isRefreshing) {
      if (timeout) {
        clearTimeout(timeout);
      }

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
    const message = TransactionMessageData.getRevokeMsg(address, deletingGrant.grantee, deletingGrant.authorization["@type"]);

    const response = await signAndBroadcastTx([message]);

    if (response) {
      setIsRefreshing("granterGrants");
      setDeletingGrant(null);
    }
  }

  async function onDeleteAllowanceConfirmed() {
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
          <Box sx={{ marginLeft: { xs: 0, sm: 0, md: "1rem" } }}>
            <Button onClick={onCreateNewGrant} color="secondary" variant="contained">
              <AccountBalanceIcon />
              &nbsp;Authorize Spend
            </Button>
          </Box>
        }
      >
        <PageContainer sx={{ paddingTop: "1rem" }}>
          <Typography variant="h6" className={classes.subTitle}>
            These authorizations allow you authorize other addresses to spend on deployments or deployment deposits using your funds. You can revoke these
            authorizations at any time.
          </Typography>
          <Fieldset label="Authorizations Given">
            {isLoadingGranterGrants || !granterGrants ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size="2rem" color="secondary" />
              </Box>
            ) : (
              <>
                {granterGrants.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <CustomTableHeader>
                        <TableRow>
                          <TableCell>Grantee</TableCell>
                          <TableCell align="right">Spending Limit</TableCell>
                          <TableCell align="right">Expiration</TableCell>
                          <TableCell align="right"></TableCell>
                        </TableRow>
                      </CustomTableHeader>

                      <TableBody>
                        {granterGrants.map(grant => (
                          <GranterRow key={grant.grantee} grant={grant} onEditGrant={onEditGrant} setDeletingGrant={setDeletingGrant} />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption">No authorizations given.</Typography>
                )}
              </>
            )}
          </Fieldset>

          <Fieldset label="Authorizations Received">
            {isLoadingGranteeGrants || !granteeGrants ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size="2rem" color="secondary" />
              </Box>
            ) : (
              <>
                {granteeGrants.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <CustomTableHeader>
                        <TableRow>
                          <TableCell>Granter</TableCell>
                          <TableCell align="right">Spending Limit</TableCell>
                          <TableCell align="right">Expiration</TableCell>
                        </TableRow>
                      </CustomTableHeader>

                      <TableBody>
                        {granteeGrants.map(grant => (
                          <GranteeRow key={grant.granter} grant={grant} />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption">No authorizations received.</Typography>
                )}
              </>
            )}
          </Fieldset>

          <Box
            sx={{
              paddingTop: "1rem",
              paddingBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <Typography variant="h1" sx={{ fontSize: "2rem", fontWeight: "bold" }}>
              Tx Fee Authorizations
            </Typography>
            <Button onClick={onCreateNewAllowance} color="secondary" variant="contained" sx={{ marginLeft: { xs: 0, sm: 0, md: "1rem" } }}>
              <AccountBalanceIcon />
              &nbsp;Authorize Fee Spend
            </Button>
          </Box>

          <Typography variant="h6" className={classes.subTitle}>
            These authorizations allow you authorize other addresses to spend on transaction fees using your funds. You can revoke these authorizations at any
            time.
          </Typography>

          <Fieldset label="Authorizations Given">
            {isLoadingAllowancesIssued || !allowancesIssued ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size="2rem" color="secondary" />
              </Box>
            ) : (
              <>
                {allowancesIssued.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <CustomTableHeader>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Grantee</TableCell>
                          <TableCell align="right">Spending Limit</TableCell>
                          <TableCell align="right">Expiration</TableCell>
                          <TableCell align="right"></TableCell>
                        </TableRow>
                      </CustomTableHeader>

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
                  </TableContainer>
                ) : (
                  <Typography variant="caption">No allowances issued.</Typography>
                )}
              </>
            )}
          </Fieldset>

          <Fieldset label="Authorizations Received">
            {isLoadingAllowancesGranted || !allowancesGranted ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size="2rem" color="secondary" />
              </Box>
            ) : (
              <>
                {allowancesGranted.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <CustomTableHeader>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Grantee</TableCell>
                          <TableCell>Spending Limit</TableCell>
                          <TableCell align="right">Expiration</TableCell>
                        </TableRow>
                      </CustomTableHeader>

                      <TableBody>
                        {allowancesGranted.map(allowance => (
                          <AllowanceGrantedRow key={allowance.granter} allowance={allowance} />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="caption">No allowances received.</Typography>
                )}
              </>
            )}
          </Fieldset>

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
        </PageContainer>
      </SettingsLayout>
    </Layout>
  );
};

export default SettingsSecurityPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
