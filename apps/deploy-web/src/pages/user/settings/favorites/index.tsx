import { UserFavorites } from "@src/components/user/UserFavorites";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { redirectIfAccessTokenExpired } from "@src/lib/nextjs/pageGuards/pageGuards";

const UserFavoritesPage: React.FunctionComponent = () => {
  return <UserFavorites />;
};

export default UserFavoritesPage;

export const getServerSideProps = defineServerSideProps({
  if: redirectIfAccessTokenExpired,
  route: "/user/settings/favorites"
});
