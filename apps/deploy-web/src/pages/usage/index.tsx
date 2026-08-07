import { UsagePage } from "@src/components/billing-usage/UsagePage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default UsagePage;

export const getServerSideProps = defineServerSideProps({
  route: "/usage",
  if: async ctx => await isFeatureEnabled("billing_usage", ctx)
});
