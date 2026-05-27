import { BillingPage } from "@src/components/billing-usage/BillingPage";
import { useIsManagedWalletUser } from "@src/context/WalletProvider";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(BillingPage, useIsManagedWalletUser);

export const getServerSideProps = defineServerSideProps({
  route: "/billing",
  if: async ctx => await isFeatureEnabled("billing_usage", ctx)
});
