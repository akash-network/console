import { Metadata, NextPage } from "next";
import { UserFavorites } from "./UserFavorites";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import { UrlService } from "@src/utils/urlUtils";

export const metadata: Metadata = {
  title: "User Favorites"
};

// const UserFavoriteTemplatesPage: NextPage = () => {
//   return <UserFavorites />;
// };

// TODO update auth0
const UserFavoriteTemplatesPage = withPageAuthRequired(
  async () => {
    return <UserFavorites />;
  },
  {
    returnTo: UrlService.userFavorites()
  }
);

export default UserFavoriteTemplatesPage;
