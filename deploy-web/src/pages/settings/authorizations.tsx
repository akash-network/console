import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import PageContainer from "@src/components/shared/PageContainer";
import SettingsLayout, { SettingsTabs } from "@src/components/settings/SettingsLayout";
import { Fieldset } from "@src/components/shared/Fieldset";
import { Box, Button, CircularProgress, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";
import { useState } from "react";
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

type Props = {};

const useStyles = makeStyles()(theme => ({
  subTitle: {
    fontSize: "1rem",
    color: theme.palette.text.secondary,
    marginBottom: "1rem"
  }
}));

const SettingsSecurityPage: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const { address } = useKeplr();
  const [editingGrant, setEditingGrant] = useState(null);
  const [editingAllowance, setEditingAllowance] = useState(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [deletingGrant, setDeletingGrant] = useState<GrantType | null>(null);
  const [deletingAllowance, setDeletingAllowance] = useState<AllowanceType | null>(null);
  const { data: granterGrants, isLoading: isLoadingGranterGrants, refetch: refetchGranterGrants } = useGranterGrants(address);
  const { data: granteeGrants, isLoading: isLoadingGranteeGrants, refetch: refetchGranteeGrants } = useGranteeGrants(address);
  const { data: allowancesIssued, isLoading: isLoadingAllowancesIssued, refetch: refetchAllowancesIssued } = useAllowancesIssued(address);
  const { data: allowancesGranted, isLoading: isLoadingAllowancesGranted, refetch: refetchAllowancesGranted } = useAllowancesGranted(address);

  const { signAndBroadcastTx } = useKeplr();

  async function onDeleteGrantConfirmed() {
    const message = TransactionMessageData.getRevokeMsg(address, deletingGrant.grantee, deletingGrant.authorization["@type"]);

    const response = await signAndBroadcastTx([message]);

    if (response) {
      refetchGranterGrants();
      setDeletingGrant(null);
    }
  }

  async function onDeleteAllowanceConfirmed() {
    const message = TransactionMessageData.getRevokeAllowanceMsg(address, deletingAllowance.grantee);

    const response = await signAndBroadcastTx([message]);

    if (response) {
      refetchAllowancesIssued();
      setDeletingAllowance(null);
    }
  }

  function onCreateNewGrant() {
    setEditingGrant(null);
    setShowGrantModal(true);
    refetchGranterGrants();
  }

  function onEditGrant(grant: GrantType) {
    setEditingGrant(grant);
    setShowGrantModal(true);
  }

  function onGrantClose() {
    refetchGranteeGrants();
    setShowGrantModal(false);
  }

  function onCreateNewAllowance() {
    setEditingAllowance(null);
    setShowAllowanceModal(true);
    refetchAllowancesIssued();
  }

  function onAllowanceClose() {
    refetchAllowancesIssued();
    setShowAllowanceModal(false);
  }

  function onEditAllowance(allowance: AllowanceType) {
    setEditingAllowance(allowance);
    setShowAllowanceModal(true);
  }

  return (
    <Layout isLoading={isLoadingAllowancesIssued || isLoadingAllowancesGranted || isLoadingGranteeGrants || isLoadingGranterGrants}>
      <NextSeo title="Settings Authorizations" />

      <SettingsLayout
        title="Deployment Authorizations"
        page={SettingsTabs.AUTHORIZATIONS}
        headerActions={
          <Box sx={{ marginLeft: { xs: 0, sm: 0, md: "1rem" } }}>
            <Button onClick={onCreateNewGrant} color="secondary" variant="contained">
              <AccountBalanceIcon />
              &nbsp;Authorize Spending
            </Button>
          </Box>
        }
      >
        <PageContainer sx={{ paddingTop: "1rem" }}>
          <Typography variant="h6" className={classes.subTitle}>
            These authorizations allow you authorize other addresses to spend on deployments using your funds. You can revoke these authorizations at any time.
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
                          <TableCell></TableCell>
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
              Fee Authorizations
            </Typography>
            <Button onClick={onCreateNewAllowance} color="secondary" variant="contained" sx={{ marginLeft: { xs: 0, sm: 0, md: "1rem" } }}>
              <AccountBalanceIcon />
              &nbsp;Authorize Fee Spend
            </Button>
          </Box>

          <Typography variant="h6" className={classes.subTitle}>
            These authorizations allow you authorize other addresses to spend on fees using your funds. You can revoke these authorizations at any time.
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
                          <TableCell></TableCell>
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
