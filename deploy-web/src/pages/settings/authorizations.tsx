import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import PageContainer from "@src/components/shared/PageContainer";
import SettingsLayout, { SettingsTabs } from "@src/components/settings/SettingsLayout";
import { Fieldset } from "@src/components/shared/Fieldset";
import { Box, Button, CircularProgress, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import { useState } from "react";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { CustomTableHeader } from "@src/components/shared/CustomTable";
import { Address } from "@src/components/shared/Address";
import { GrantModal } from "@src/components/wallet/GrantModal";
import { GrantType } from "@src/types/grant";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useGranteeGrants, useGranterGrants } from "@src/queries/useGrantsQuery";
import { Popup } from "@src/components/shared/Popup";
import { GranterRow } from "@src/components/settings/GranterRow";
import { GranteeRow } from "@src/components/settings/GranteeRow";

type Props = {};

const SettingsSecurityPage: React.FunctionComponent<Props> = ({}) => {
  const { address } = useKeplr();
  const [editingGrant, setEditingGrant] = useState(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [deletingGrant, setDeletingGrant] = useState<GrantType | null>(null);
  const { data: granterGrants, isLoading: isLoadingGranterGrants, refetch: refetchGranterGrants } = useGranterGrants(address);
  const { data: granteeGrants, isLoading: isLoadingGranteeGrants, refetch: refetchGranteeGrants } = useGranteeGrants(address);

  const { signAndBroadcastTx } = useKeplr();

  async function onDeleteGrantConfirmed() {
    const message = TransactionMessageData.getRevokeMsg(address, deletingGrant.grantee, deletingGrant.authorization["@type"]);

    const response = await signAndBroadcastTx([message]);

    if (response) {
      refetchGranterGrants();
      setDeletingGrant(null);
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

  return (
    <Layout>
      <NextSeo title="Settings Authorizations" />

      <SettingsLayout
        title="Authorizations"
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
        <PageContainer>
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
                  <p>No authorizations given</p>
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
                  <p>No authorizations received</p>
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
          {showGrantModal && <GrantModal editingGrant={editingGrant} address={address} onClose={onGrantClose} />}
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
