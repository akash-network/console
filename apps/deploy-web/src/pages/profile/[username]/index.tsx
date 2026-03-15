import { isHttpError } from "@akashnetwork/http-sdk";
import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { UserProfile } from "@src/components/user/UserProfile";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { IUserSetting } from "@src/types/user";

type Props = {
  username: string;
  user: IUserSetting | null;
};

const UserProfilePage: React.FunctionComponent<Props> = ({ username, user }) => {
  return <UserProfile username={username} user={user} />;
};

export default UserProfilePage;

export const getServerSideProps = defineServerSideProps({
  route: "/profile/[username]",
  schema: z.object({
    params: z.object({
      username: z.string()
    })
  }),
  async handler({ params, services }): Promise<GetServerSidePropsResult<Props>> {
    try {
      const { data: user } = await services.consoleApiHttpClient.get(
        `${services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID)}/v1/user/byUsername/${params.username}`
      );

      return {
        props: {
          username: params.username,
          user
        }
      };
    } catch (error) {
      if (isHttpError(error) && error.response?.status === 404) {
        return {
          props: {
            username: params.username,
            user: null
          }
        };
      }
      throw error;
    }
  }
});
