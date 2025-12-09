import { PaymentMethodsPage } from "@src/components/billing-usage/PaymentMethodsPage";
import { useIsManagedWalletUser } from "@src/context/WalletProvider";
import { composeGuards, Guard } from "@src/hoc/guard/guard.hoc";
import { useIsRegisteredUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(PaymentMethodsPage, composeGuards(useIsManagedWalletUser, useIsRegisteredUser));

export const getServerSideProps = defineServerSideProps({
  route: "/payment-methods",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("auto_credit_reload", ctx))
});
