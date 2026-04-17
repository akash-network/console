/**
 * We use vi.mock in these tests because this components are mostly copied from Cosmos Kit with some minor adjustments,
 * and we don't want to change them too much. Hopefully, they eventually will be removed
 */

import { type ReactNode, useEffect } from "react";
import type { ChainWalletBase, WalletRepo } from "@cosmos-kit/core";
import { WalletStatus } from "@cosmos-kit/core";
import { createStore, Provider as JotaiProvider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChainStoreProvider, useChainStore } from "../../context/ChainStoreProvider";
import { ChainStore } from "../../store/ChainStore";
import { WalletModal } from "./WalletModal";

import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@interchain-ui/react", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ConnectModal: ({ isOpen, children, header, onClose }: { isOpen: boolean; children: ReactNode; header: ReactNode; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="connect-modal">
        <div data-testid="modal-header">{header}</div>
        <div data-testid="modal-content">{children}</div>
        <button data-testid="modal-close" onClick={onClose} />
      </div>
    ) : null,
  ConnectModalHead: ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div>
      <span>{title}</span>
      <button data-testid="head-close" onClick={onClose} />
    </div>
  ),
  ConnectModalWalletList: ({
    wallets,
    onWalletItemClick
  }: {
    wallets: { originalWallet: ChainWalletBase; prettyName: string }[];
    onWalletItemClick: (w: ChainWalletBase) => void;
  }) => (
    <ul>
      {wallets.map(w => (
        <li key={w.prettyName}>
          <button onClick={() => onWalletItemClick(w.originalWallet)}>{w.prettyName}</button>
        </li>
      ))}
    </ul>
  )
}));

vi.mock("@cosmos-kit/react", () => ({
  defaultModalViews: {
    WalletList: vi.fn(() => ({ head: null, content: null })),
    Connecting: vi.fn(() => ({ head: <span>Connecting...</span>, content: <span>Please wait</span> })),
    Connected: vi.fn(() => ({ head: <span>Connected</span>, content: <span>Success</span> })),
    Error: vi.fn(() => ({ head: <span>Error</span>, content: <span>Failed</span> })),
    Rejected: vi.fn(() => ({ head: <span>Rejected</span>, content: <span>User rejected</span> })),
    NotExist: vi.fn(() => ({ head: <span>Not Found</span>, content: <span>Wallet not found</span> })),
    QRCode: vi.fn(() => ({ head: <span>QR Code</span>, content: <span>Scan QR</span> }))
  }
}));

describe(WalletModal.name, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render modal when closed", () => {
    setup({ isOpen: false });

    expect(screen.queryByTestId("connect-modal")).not.toBeInTheDocument();
  });

  it("renders modal when open", () => {
    setup({ isOpen: true });

    expect(screen.getByTestId("connect-modal")).toBeInTheDocument();
  });

  it("renders wallet list view by default", () => {
    setup({ isOpen: true });

    expect(screen.getByText("Select your wallet")).toBeInTheDocument();
  });

  it("calls setOpen(false) when modal is closed", () => {
    const setOpen = vi.fn();
    setup({ isOpen: true, setOpen });

    fireEvent.click(screen.getByTestId("modal-close"));

    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("shows connected view when selected wallet is connected and modal opens", () => {
    const wallet = createMockChainWallet("wallet-b", "Wallet B", WalletStatus.Connected);
    const walletRepo = createMockWalletRepo([wallet]);

    setup({
      isOpen: true,
      walletRepo,
      selectedWalletName: "wallet-b"
    });

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("finds current wallet by matching selectedWalletNameAtom from Jotai store", () => {
    const walletA = createMockChainWallet("wallet-a", "Wallet A", WalletStatus.Disconnected);
    const walletB = createMockChainWallet("wallet-b", "Wallet B", WalletStatus.Connected);
    const walletRepo = createMockWalletRepo([walletA, walletB]);

    setup({
      isOpen: true,
      walletRepo,
      selectedWalletName: "wallet-b"
    });

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("Select your wallet")).not.toBeInTheDocument();
  });

  it("disconnects wallet when closing during connection", () => {
    const wallet = createMockChainWallet("keplr", "Keplr", WalletStatus.Connecting);
    const walletRepo = createMockWalletRepo([wallet]);

    setup({
      isOpen: true,
      walletRepo,
      selectedWalletName: "keplr"
    });

    fireEvent.click(screen.getByTestId("modal-close"));

    expect(wallet.disconnect).toHaveBeenCalled();
  });

  it("does not disconnect wallet when closing in connected state", () => {
    const wallet = createMockChainWallet("keplr", "Keplr", WalletStatus.Connected);
    const walletRepo = createMockWalletRepo([wallet]);

    setup({
      isOpen: true,
      walletRepo,
      selectedWalletName: "keplr"
    });

    fireEvent.click(screen.getByTestId("modal-close"));

    expect(wallet.disconnect).not.toHaveBeenCalled();
  });

  describe("WalletListView", () => {
    it("renders wallet names from walletRepo", () => {
      const walletA = createMockChainWallet("wallet-a", "Wallet A", WalletStatus.Disconnected);
      const walletB = createMockChainWallet("wallet-b", "Wallet B", WalletStatus.Disconnected);
      const walletRepo = createMockWalletRepo([walletA, walletB]);

      setup({ isOpen: true, walletRepo });

      expect(screen.getByText("Wallet A")).toBeInTheDocument();
      expect(screen.getByText("Wallet B")).toBeInTheDocument();
    });

    it("sets selected wallet name in chain store when wallet is clicked", async () => {
      const wallet = createMockChainWallet("keplr", "Keplr", WalletStatus.Disconnected);
      const walletRepo = createMockWalletRepo([wallet]);

      let chainStore: ChainStore | null = null;
      setup({
        isOpen: true,
        walletRepo,
        onRenderChainStore: store => {
          chainStore = store;
        }
      });

      fireEvent.click(screen.getByText("Keplr"));
      await vi.waitFor(() => chainStore instanceof ChainStore);

      expect((chainStore as unknown as ChainStore).setSelectedWalletName).toHaveBeenCalledWith("keplr");
    });

    it("calls wallet.connect when wallet is clicked", () => {
      const wallet = createMockChainWallet("keplr", "Keplr", WalletStatus.Disconnected);
      const walletRepo = createMockWalletRepo([wallet]);

      setup({ isOpen: true, walletRepo });

      fireEvent.click(screen.getByText("Keplr"));

      expect(wallet.connect).toHaveBeenCalledWith(true);
    });

    it("passes false to connect when wallet status is NotExist", () => {
      const wallet = createMockChainWallet("keplr", "Keplr", WalletStatus.NotExist);
      const walletRepo = createMockWalletRepo([wallet]);

      setup({ isOpen: true, walletRepo });

      fireEvent.click(screen.getByText("Keplr"));

      expect(wallet.connect).toHaveBeenCalledWith(false);
    });

    it("sorts non-wallet-connect wallets before wallet-connect wallets", () => {
      const wcWallet = createMockChainWallet("wc-wallet", "WC Wallet", WalletStatus.Disconnected, "wallet-connect");
      const extensionWallet = createMockChainWallet("ext-wallet", "Extension Wallet", WalletStatus.Disconnected, "extension");
      const walletRepo = createMockWalletRepo([wcWallet, extensionWallet]);

      setup({ isOpen: true, walletRepo });

      const buttons = screen.getAllByRole("button", { name: /Wallet/ });
      expect(buttons[0]).toHaveTextContent("Extension Wallet");
      expect(buttons[1]).toHaveTextContent("WC Wallet");
    });
  });

  function setup(input: {
    isOpen: boolean;
    setOpen?: (open: boolean) => void;
    walletRepo?: WalletRepo;
    selectedWalletName?: string;
    onRenderChainStore?: (chainStore: ChainStore) => void;
  }) {
    const jotaiStore = createStore();
    const walletRepo = input.walletRepo ?? createMockWalletRepo([]);

    render(
      <JotaiProvider store={jotaiStore}>
        <ChainStoreProvider walletsRegistry={{}} walletManagerOptions={{ chains: [], assetList: [] }}>
          <MockChainStoreProvider selectedWalletName={input.selectedWalletName} onRenderChainStore={input.onRenderChainStore}>
            <WalletModal isOpen={input.isOpen} setOpen={input.setOpen ?? vi.fn()} walletRepo={walletRepo} />
          </MockChainStoreProvider>
        </ChainStoreProvider>
      </JotaiProvider>
    );

    return { jotaiStore };
  }
});

function MockChainStoreProvider({
  children,
  selectedWalletName,
  onRenderChainStore
}: {
  children: ReactNode;
  selectedWalletName?: string;
  onRenderChainStore?: (chainStore: ChainStore) => void;
}) {
  const chainStore = useChainStore();

  if (selectedWalletName) {
    chainStore.setSelectedWalletName(selectedWalletName);
  }

  useEffect(() => {
    if (onRenderChainStore) {
      vi.spyOn(chainStore, "setSelectedWalletName");
      onRenderChainStore(chainStore);
    }
  }, [chainStore, onRenderChainStore]);
  return <>{children}</>;
}

function createMockChainWallet(name: string, prettyName: string, status: WalletStatus, mode: string = "extension"): ChainWalletBase {
  return {
    walletName: name,
    walletStatus: status,
    message: undefined,
    client: undefined,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    walletInfo: {
      name,
      prettyName,
      mode,
      logo: "https://example.com/logo.png",
      mobileDisabled: false
    }
  } as unknown as ChainWalletBase;
}

function createMockWalletRepo(wallets: ChainWalletBase[]): WalletRepo {
  return {
    wallets,
    platformEnabledWallets: wallets,
    setCallbackOptions: vi.fn()
  } as unknown as WalletRepo;
}
