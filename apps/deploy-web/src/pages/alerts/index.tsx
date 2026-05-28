import { AlertsPage } from "@src/components/alerts/AlertsPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default AlertsPage;

export const getServerSideProps = defineServerSideProps({
  route: "/alerts",
  if: async ctx => await isFeatureEnabled("alerts", ctx)
});
