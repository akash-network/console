import { RequiredUserContainer } from "@src/components/user/RequiredUserContainer";
import { UserSettingsForm } from "@src/components/user/UserSettingsForm";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

const UserSettingsPage: React.FunctionComponent = () => {
  return <RequiredUserContainer>{user => <UserSettingsForm user={user} />}</RequiredUserContainer>;
};

export default UserSettingsPage;

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/user/settings"
});
