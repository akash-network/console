import type {
  BRIDGES,
  FiatOnRampProps,
  IBCSwapsProps,
  IBCTransferProps,
  MultiViewProps,
  SwapsProps,
  SwapVenue,
  ViewMountEventsContextType,
  WalletType
} from "@leapwallet/elements";

type ViewWrapperProps = {
  connectWallet: () => void;
  connectedWalletType?: WalletType;
  bridges?: BRIDGES[];
  swapVenues?: SwapVenue[];
  enableSmartSwap?: boolean;
  mountEventHandlers?: ViewMountEventsContextType;
  element:
    | {
        name: "multi-view";
        props: MultiViewProps;
      }
    | {
        name: "aggregated-swaps";
        props: SwapsProps;
      }
    | {
        name: "ibc-swaps";
        props: IBCSwapsProps;
      }
    | {
        name: "fiat-on-ramp";
        props: FiatOnRampProps;
      }
    | {
        name: "ibc-transfer";
        props: IBCTransferProps;
      };
};

type ElementsOptionalConfig = {
  skipClientId?: string;
  leapIntegratorId?: string;
  enableCaching?: boolean;
};

type RenderRootArgs = {
  elementsRoot?: string;
};

type mountElementsArgs = ElementsOptionalConfig & RenderRootArgs & ViewWrapperProps;

// extend the global Window interface
declare global {
  interface Window {
    LeapElements?: {
      mountElements: (args: mountElementsArgs) => void;
      WalletType: typeof WalletType;
    };
  }
}
