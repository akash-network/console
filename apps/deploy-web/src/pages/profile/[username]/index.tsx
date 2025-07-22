import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { UserProfile } from "@src/components/user/UserProfile";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { IUserSetting } from "@src/types/user";

type Props = {
  username: string;
  user: IUserSetting;
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
    const { data: user } = await services.consoleApiHttpClient.get(`${services.apiUrlService.getBaseApiUrlFor("mainnet")}/user/byUsername/${params.username}`);

    return {
      props: {
        username: params.username,
        user
      }
    };
  }
});
