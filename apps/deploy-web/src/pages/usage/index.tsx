import { UsagePage } from "@src/components/billing-usage/UsagePage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default RegisteredUsersOnly(UsagePage);

export const getServerSideProps = defineServerSideProps({
  route: "/usage",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("billing_usage", ctx))
});
