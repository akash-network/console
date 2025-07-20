import { UsagePage } from "@src/components/billing-usage/UsagePage";
import { useWallet } from "@src/context/WalletProvider";
import { composeGuards, Guard } from "@src/hoc/guard/guard.hoc";
import { useUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

const useIsManagedWalletUser = () => {
  const { isManaged } = useWallet();
  return isManaged;
};

const useIsRegisteredUser = () => {
  const user = useUser();
  return !!user?.userId;
};

export default Guard(UsagePage, composeGuards(useIsManagedWalletUser, useIsRegisteredUser));

export const getServerSideProps = defineServerSideProps({
  route: "/usage",
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("billing_usage", ctx))
});
