import { Metadata, NextPage } from "next";
import { AddressBookTable } from "./AddressBookTable";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

export const metadata: Metadata = {
  title: "User Address Book"
};

const UserAddressBookPage: NextPage = () => {
  return <AddressBookTable />;
};

// TODO update auth0
// const UserFavoriteTemplatesPage: NextPage = withCustomPageAuthRequired(async () => {
//   return <UserFavorites />;
// });

export default UserAddressBookPage;
