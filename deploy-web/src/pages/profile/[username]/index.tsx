import { UrlService } from "@src/utils/urlUtils";
import { Metadata } from "next";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import { UserProfile } from "../../../components/user/UserProfile";
import { IUserSetting } from "@src/types/user";
import axios from "axios";

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
  const response = await axios.get(`${BASE_API_MAINNET_URL}/user/byUsername/${username}`);
  return response.data;
}
