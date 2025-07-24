import { UsagePage } from "@src/components/billing-usage/UsagePage";
import { useIsManagedWalletUser } from "@src/context/WalletProvider";
import { composeGuards, Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(UsagePage, composeGuards(useIsManagedWalletUser, useIsRegisteredUser));

export const getServerSideProps = defineServerSideProps({
  route: "/usage",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("billing_usage", ctx))
});
