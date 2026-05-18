import { z } from "zod";

import { AuthPagePasswordlessClient } from "@src/components/auth/AuthPagePasswordless/AuthPagePasswordless";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated } from "@src/lib/nextjs/pageGuards/pageGuards";

export default function LoginV2Page() {
  return <AuthPagePasswordlessClient />;
}

export const getServerSideProps = defineServerSideProps({
  route: "/login-v2",
  schema: z.object({
    query: z.object({
      returnTo: z.union([z.string(), z.array(z.string())]).optional()
    })
  }),
  handler: async ctx => {
    if (await isAuthenticated(ctx)) {
      return { redirect: { destination: "/", permanent: false } };
    }
    return { props: {} };
  }
});
