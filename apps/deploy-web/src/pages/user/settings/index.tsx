import { ProfilePage } from "@src/components/user/ProfilePage/ProfilePage";
import { useUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

const UserSettingsPage = () => {
  const { user } = useUser();
  if (!user) return null;
  return <ProfilePage user={user} />;
};

export default UserSettingsPage;

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/user/settings"
});
