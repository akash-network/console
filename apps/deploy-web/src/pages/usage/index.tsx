import { UsagePage } from "@src/components/billing-usage/UsagePage";
import { useIsManagedWalletUser } from "@src/context/WalletProvider";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default Guard(UsagePage, useIsManagedWalletUser);

export const getServerSideProps = defineServerSideProps({
  route: "/usage",
  if: async ctx => await isFeatureEnabled("billing_usage", ctx)
});
