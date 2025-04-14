import { UserFavorites } from "@src/components/user/UserFavorites";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const UserFavoritesPage: React.FunctionComponent = () => {
  return <UserFavorites />;
};

export default UserFavoritesPage;

export const getServerSideProps = withCustomPageAuthRequired({
  getServerSideProps: getServerSidePropsWithServices(async () => {
    return {
      props: {}
    };
  })
});
