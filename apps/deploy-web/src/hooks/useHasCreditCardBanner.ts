import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider";

const withBilling = browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;

export function useHasCreditCardBanner() {
  const { hasManagedWallet, isTrialing } = useWallet();

  return withBilling && !hasManagedWallet && !isTrialing;
}
