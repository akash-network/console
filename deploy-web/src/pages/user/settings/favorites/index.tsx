import { UserFavorites } from "@src/components/user/UserFavorites";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

type Props = {};

const UserFavoritesPage: React.FunctionComponent<Props> = ({}) => {
  return <UserFavorites />;
};

export default UserFavoritesPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps({ params, req, res }) {
    return {
      props: {}
    };
  }
});
