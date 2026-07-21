import { z } from "zod";

import { AuthPage } from "@src/components/auth/AuthPage/AuthPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated } from "@src/lib/nextjs/pageGuards/pageGuards";
import { definePublicPage } from "@src/lib/pages/definePublicPage";

const LoginPage = () => {
  return <AuthPage />;
};

export default definePublicPage(LoginPage);

export const getServerSideProps = defineServerSideProps({
  route: "/login",
  public: true,
  schema: z.object({
    query: z.object({
      tab: z.enum(["login", "signup", "forgot-password"]).default("login"),
      returnTo: z.union([z.string(), z.array(z.string())]).optional(),
      from: z.union([z.string(), z.array(z.string())]).optional()
    })
  }),
  handler: async ctx => {
    if (await isAuthenticated(ctx)) {
      return {
        redirect: {
          destination: "/",
          permanent: false
        }
      };
    }

    return {
      props: {}
    };
  }
});
