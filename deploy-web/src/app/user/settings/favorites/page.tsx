import { Metadata, NextPage } from "next";
import { UserFavorites } from "./UserFavorites";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

export const metadata: Metadata = {
  title: "User Favorites"
};

const UserFavoriteTemplatesPage: NextPage = () => {
  return <UserFavorites />;
};

// TODO update auth0
// const UserFavoriteTemplatesPage: NextPage = withCustomPageAuthRequired(async () => {
//   return <UserFavorites />;
// });

export default UserFavoriteTemplatesPage;
