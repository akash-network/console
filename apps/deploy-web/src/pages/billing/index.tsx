import { BillingPage } from "@src/components/billing-usage/BillingPage";
import { useIsManagedWalletUser } from "@src/context/WalletProvider";
import { composeGuards, Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(BillingPage, composeGuards(useIsManagedWalletUser, useIsRegisteredUser));

export const getServerSideProps = defineServerSideProps({
  route: "/billing",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("billing_usage", ctx))
});
