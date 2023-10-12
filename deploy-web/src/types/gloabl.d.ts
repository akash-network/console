import { Window as KeplrWindow, keplr } from "@keplr-wallet/types";
declare global {
  interface Window extends KeplrWindow {
    wallet: keplr;
    leap: keplr;
  }
}

