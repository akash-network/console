import type { Keplr, Window as KeplrWindow } from "@keplr-wallet/types";

declare global {
  interface Window extends KeplrWindow {
    wallet: Keplr | undefined;
    LeapElements?: {
      mountElements: (args: any) => void;
      WalletType: any;
    };
  }
}
