import axios from "axios";
import type { GetServerSideProps } from "next";

import { UserProfile } from "@src/components/user/UserProfile";
import { serverEnvConfig } from "@src/config/server-env.config";
import type { IUserSetting } from "@src/types/user";

type Props = {
  username: string;
  user: IUserSetting;
};

const UserProfilePage: React.FunctionComponent<Props> = ({ username, user }) => {
  return <UserProfile username={username} user={user} />;
};

export default UserProfilePage;

export const getServerSideProps: GetServerSideProps<Props, Pick<Props, "username">> = async ({ params }) => {
  try {
    const user = await fetchUser(params!.username);

    return {
      props: {
        username: params!.username,
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
};

async function fetchUser(username: string) {
  const response = await axios.get(`${serverEnvConfig.BASE_API_MAINNET_URL}/user/byUsername/${username}`);
  return response.data;
}
