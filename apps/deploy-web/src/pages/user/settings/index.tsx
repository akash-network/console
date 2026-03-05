import { UserSettingsForm } from "@src/components/user/UserSettingsForm";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser, useUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

const UserSettingsPage = () => {
  const { user } = useUser();
  if (!user) return null;
  return <UserSettingsForm user={user} />;
};

export default Guard(UserSettingsPage, useIsRegisteredUser);

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/user/settings"
});
