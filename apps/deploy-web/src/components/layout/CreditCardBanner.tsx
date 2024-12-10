import { useWallet } from "@src/context/WalletProvider/WalletProvider";
import { ConnectManagedWalletButton } from "../wallet/ConnectManagedWalletButton";

export function CreditCardBanner() {
  const { hasManagedWallet } = useWallet();

  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">Credit Card payments are now available!</span>

      {!hasManagedWallet && <ConnectManagedWalletButton className="flex-shrink-0 text-white hover:text-white" size="sm" variant="text" />}
    </div>
  );
}
