import { AlertsPage } from "@src/components/alerts/AlertsPage";
import { RegisteredUsersOnly } from "@src/hoc/registered-users-only/registered-users-only.hoc";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default RegisteredUsersOnly(AlertsPage);

export const getServerSideProps = defineServerSideProps({
  route: "/alerts",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("alerts", ctx))
});
