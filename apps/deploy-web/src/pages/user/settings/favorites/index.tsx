import { UserFavorites } from "@src/components/user/UserFavorites";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const UserFavoritesPage: React.FunctionComponent = () => {
  return <UserFavorites />;
};

export default UserFavoritesPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps() {
    return {
      props: {}
    };
  }
});
