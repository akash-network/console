import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import PageContainer from "@src/components/shared/PageContainer";
import SettingsLayout, { SettingsTabs } from "@src/components/settings/SettingsLayout";
import { Fieldset } from "@src/components/shared/Fieldset";
import { Box, Button, CircularProgress, IconButton, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import { useState } from "react";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { CustomTableHeader, CustomTableRow } from "@src/components/shared/CustomTable";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { coinToUAkt } from "@src/utils/priceUtils";
import { FormattedTime } from "react-intl";
import { Address } from "@src/components/shared/Address";
import { GrantModal } from "@src/components/wallet/GrantModal";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { GrantType } from "@src/types/grant";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useGranteeGrants, useGranterGrants } from "@src/queries/useGrantsQuery";
import { Popup } from "@src/components/shared/Popup";

type Props = {};

const SettingsSecurityPage: React.FunctionComponent<Props> = ({}) => {
  const { address } = useKeplr();
  const [editingGrant, setEditingGrant] = useState(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [deletingGrant, setDeletingGrant] = useState<GrantType | null>(null);
  const { data: granterGrants, isLoading: isLoadingGranterGrants, refetch: refetchGranterGrants } = useGranterGrants(address);
  const { data: granteeGrants, isLoading: isLoadingGranteeGrants } = useGranteeGrants(address);

  const { signAndBroadcastTx } = useKeplr();

  async function onDeleteGrantConfirmed() {
    const message = TransactionMessageData.getRevokeMsg(address, deletingGrant.grantee);

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
              <CircularProgress size="1.5rem" color="secondary" />
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
                          <CustomTableRow key={grant.grantee}>
                            <TableCell>
                              <Address address={grant.grantee} isCopyable />
                            </TableCell>
                            <TableCell align="right">
                              <AKTAmount uakt={coinToUAkt(grant.authorization.spend_limit)} /> AKT
                            </TableCell>
                            <TableCell align="right">
                              <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
                            </TableCell>
                            <TableCell>
                              <IconButton onClick={() => onEditGrant(grant)}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => setDeletingGrant(grant)}>
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </CustomTableRow>
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
              <CircularProgress size="1.5rem" color="secondary" />
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
                          <CustomTableRow key={grant.granter}>
                            <TableCell>
                              <Address address={grant.granter} isCopyable />
                            </TableCell>
                            <TableCell align="right">
                              <AKTAmount uakt={coinToUAkt(grant.authorization.spend_limit)} /> AKT
                            </TableCell>
                            <TableCell align="right">
                              <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
                            </TableCell>
                          </CustomTableRow>
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
            >
              Deleting grant to{" "}
              <strong>
                <Address address={deletingGrant.grantee} />
              </strong>{" "}
              will revoke their ability to spend your funds on deployments.
            </Popup>
          )}
          {showGrantModal && <GrantModal editingGrant={editingGrant} address={address} onClose={() => setShowGrantModal(false)} />}
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
