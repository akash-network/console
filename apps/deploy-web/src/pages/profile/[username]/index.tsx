import { z } from "zod";

import type { UserProfileRouteProps } from "@src/components/user/loadUserProfileRouteProps";
import { loadUserProfileRouteProps } from "@src/components/user/loadUserProfileRouteProps";
import { UserProfile } from "@src/components/user/UserProfile";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

const UserProfilePage: React.FunctionComponent<UserProfileRouteProps> = ({ username, user }) => {
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
  handler: context => loadUserProfileRouteProps(context.params.username, context)
});
