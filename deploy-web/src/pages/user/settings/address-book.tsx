import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import { CircularProgress, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";
import { useAddressBook } from "@src/context/AddressBookProvider";
import { CustomTableHeader, CustomTableRow } from "@src/components/shared/CustomTable";
import { AddressLink } from "@src/components/shared/AddressLink";
import EditIcon from "@mui/icons-material/Edit";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";
import { UserProfileLayout } from "@src/app/profile/[username]/UserProfileLayout";

type Props = {};

const UserAddressBookPage: React.FunctionComponent<Props> = ({}) => {
  const { addressNames, editAddressName, isLoading: isLoadingAddressBook } = useAddressBook();
  const { user, isLoading } = useCustomUser();

  const addressNamesArray = Object.keys(addressNames).map(address => ({ address, name: addressNames[address] }));

  return (
    <Layout>
      <NextSeo title={user?.username} />

      <UserProfileLayout page="address-book" username={user?.username} bio={user?.bio}>
        {(isLoading || isLoadingAddressBook) && <CircularProgress color="secondary" />}

        <Paper sx={{ mt: "1rem", padding: "1rem" }} elevation={2}>
          {!isLoading && addressNamesArray?.length === 0 && (
            <div>
              <Typography variant="body1" sx={{ marginBottom: ".5rem" }}>
                No saved addresses.
              </Typography>

              <Typography variant="body2">Go on any address page and save the address directly!</Typography>
            </div>
          )}

          {addressNamesArray.length > 0 && (
            <TableContainer>
              <Table size="small">
                <CustomTableHeader>
                  <TableRow>
                    <TableCell width="50%">Address</TableCell>
                    <TableCell width="50%">Name</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </CustomTableHeader>

                <TableBody>
                  {addressNamesArray.map(({ address, name }) => (
                    <CustomTableRow key={address}>
                      <TableCell>
                        <AddressLink address={address} addressBookMode="never" />
                      </TableCell>
                      <TableCell>{name}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            editAddressName(address);
                            event(AnalyticsEvents.EDIT_ADDRESS_BOOK, {
                              category: "settings",
                              label: "Edit address from address book"
                            });
                          }}
                          sx={{ marginLeft: ".5rem" }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </CustomTableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </UserProfileLayout>
    </Layout>
  );
};

export default UserAddressBookPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps({ params, req, res }) {
    return {
      props: {}
    };
  }
});
