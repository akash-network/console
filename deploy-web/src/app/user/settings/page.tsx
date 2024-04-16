import { Metadata, NextPage } from "next";
import { UserSettingsForm } from "./UserSettingsForm";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

export const metadata: Metadata = {
  title: "User Settings"
};

const UserSettingsPage: NextPage = () => {
  return <UserSettingsForm />;
};

// TODO update aoth0
// const UserFavoriteTemplatesPage: NextPage = withCustomPageAuthRequired(async () => {
//   return <UserFavorites />;
// });

export default UserSettingsPage;
