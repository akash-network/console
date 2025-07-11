import { UserFavorites } from "@src/components/user/UserFavorites";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const UserFavoritesPage: React.FunctionComponent = () => {
  return <UserFavorites />;
};

export default UserFavoritesPage;

export const getServerSideProps = withCustomPageAuthRequired({
  getServerSideProps: defineServerSideProps({
    route: "/user/settings/favorites"
  })
});
