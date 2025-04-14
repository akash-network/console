import { UserProfile } from "@src/components/user/UserProfile";
import { serverEnvConfig } from "@src/config/server-env.config";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import type { IUserSetting } from "@src/types/user";

type Props = {
  username: string;
  user: IUserSetting;
};

const UserProfilePage: React.FunctionComponent<Props> = ({ username, user }) => {
  return <UserProfile username={username} user={user} />;
};

export default UserProfilePage;

export const getServerSideProps = getServerSidePropsWithServices<Props, Pick<Props, "username">>(async ({ params, services }) => {
  if (!params?.username) {
    return {
      notFound: true
    };
  }

  try {
    const { data: user } = await services.axios.get(`${serverEnvConfig.BASE_API_MAINNET_URL}/user/byUsername/${params.username}`);

    return {
      props: {
        username: params.username,
        user
      }
    };
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
});
