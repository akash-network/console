import { BillingPage } from "@src/components/billing-usage/BillingPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default BillingPage;

export const getServerSideProps = defineServerSideProps({
  route: "/billing",
  if: async ctx => await isFeatureEnabled("billing_usage", ctx)
});
