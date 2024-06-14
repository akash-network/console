import { Edit } from "iconoir-react";
import { NextSeo } from "next-seo";
import { event } from "nextjs-google-analytics";

import { AddressLink } from "@src/components/shared/AddressLink";
import Spinner from "@src/components/shared/Spinner";
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { UserProfileLayout } from "@src/components/user/UserProfileLayout";
import { useAddressBook } from "@src/context/AddressBookProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { AnalyticsEvents } from "@src/utils/analytics";
import Layout from "../layout/Layout";

export const AddressBookTable: React.FunctionComponent = () => {
  const { addressNames, editAddressName, isLoading: isLoadingAddressBook } = useAddressBook();
  const { user, isLoading } = useCustomUser();

  const addressNamesArray = Object.keys(addressNames || {}).map(address => ({ address, name: addressNames[address] }));

  return (
    <Layout isLoading={isLoading}>
      <NextSeo title={user?.username} />
      <UserProfileLayout page="address-book" username={user?.username} bio={user?.bio}>
        <Card className="mt-4">
          <CardContent className="p-4">
            {(isLoading || isLoadingAddressBook) && (
              <div className="flex items-center justify-center p-8">
                <Spinner size="large" />
              </div>
            )}

            {!isLoading && addressNamesArray?.length === 0 && (
              <div>
                <p className="mb-2">No saved addresses.</p>
              </div>
            )}

            {addressNamesArray.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">Address</TableHead>
                    <TableHead className="w-1/2">Name</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {addressNamesArray.map(({ address, name }) => (
                    <TableRow key={address}>
                      <TableCell>
                        <AddressLink address={address} />
                      </TableCell>
                      <TableCell>{name}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-2"
                          onClick={() => {
                            editAddressName(address);
                            event(AnalyticsEvents.EDIT_ADDRESS_BOOK, {
                              category: "settings",
                              label: "Edit address from address book"
                            });
                          }}
                        >
                          <Edit className="text-sm" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isLoading && !isLoadingAddressBook && (
              <Button
                className="mt-4"
                onClick={() => {
                  editAddressName("");
                  event(AnalyticsEvents.ADDRESS_BOOK_ADD_ADDRESS, {
                    category: "settings",
                    label: "Add address to address book"
                  });
                }}
              >
                Add Address
              </Button>
            )}
          </CardContent>
        </Card>
      </UserProfileLayout>
    </Layout>
  );
};
