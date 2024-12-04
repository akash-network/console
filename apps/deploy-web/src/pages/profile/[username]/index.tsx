import axios from "axios";

import { UserProfile } from "@src/components/user/UserProfile";
import { serverEnvConfig } from "@src/config/server-env.config";
import { IUserSetting } from "@src/types/user";

type Props = {
  username: string;
  user: IUserSetting;
};

const UserProfilePage: React.FunctionComponent<Props> = ({ username, user }) => {
  return <UserProfile username={username} user={user} />;
};

export default UserProfilePage;

export async function getServerSideProps({ params }) {
  try {
    const user = await fetchUser(params?.username);

    return {
      props: {
        username: params?.username,
        user
      }
    };
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
}

async function fetchUser(username: string) {
  const response = await axios.get(`${serverEnvConfig.BASE_API_MAINNET_URL}/user/byUsername/${username}`);
  return response.data;
}
