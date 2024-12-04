import { useWallet } from "@src/context/WalletProvider/WalletProvider";
import { ConnectManagedWalletButton } from "../wallet/ConnectManagedWalletButton";

export function CreditCardBanner() {
  const { hasManagedWallet } = useWallet();

  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center space-x-4 bg-primary px-3 py-2">
      <span className="text-sm font-semibold text-white">Credit Card payments are now available!</span>

      {!hasManagedWallet && <ConnectManagedWalletButton className="mb-2 mr-2 w-full md:mb-0 md:w-auto text-white hover:text-white" size="sm" variant="text" />}
    </div>
  );
}
