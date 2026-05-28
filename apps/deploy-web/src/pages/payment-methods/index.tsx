import { PaymentMethodsPage } from "@src/components/billing-usage/PaymentMethodsPage";
import { useIsManagedWalletUser } from "@src/context/WalletProvider";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(PaymentMethodsPage, useIsManagedWalletUser);

export const getServerSideProps = defineServerSideProps({
  route: "/payment-methods",
  if: async ctx => await isFeatureEnabled("auto_credit_reload", ctx)
});
