import type { CertificatesService } from "@akashnetwork/http-sdk";
import { mock } from "jest-mock-extended";

import { CertificateProvider } from "@src/context/CertificateProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import type { ContextType as WalletContextType } from "@src/context/WalletProvider/WalletProvider";
import { WalletProviderContext } from "@src/context/WalletProvider/WalletProvider";
import type { Props as CreateCertificateButtonProps } from "./CreateCertificateButton";
import { CreateCertificateButton } from "./CreateCertificateButton";

import { fireEvent, render, screen } from "@testing-library/react";

describe(CreateCertificateButton.name, () => {
  it("renders create certificate button", () => {
    setup();
    expect(screen.getByRole("button", { name: /create certificate/i })).toBeInTheDocument();
  });

  it("calls createCertificate when clicked", async () => {
    const createCertificateController = Promise.withResolvers<boolean>();
    const signAndBroadcastTx = jest.fn(() => createCertificateController.promise);
    const walletAddress = "akash1234567890";
    setup({ walletAddress, signAndBroadcastTx });

    const button = screen.getByRole("button", { name: /create certificate/i });
    fireEvent.click(button);

    expect(signAndBroadcastTx).toHaveBeenCalledWith([
      {
        typeUrl: "",
        value: {
          owner: walletAddress,
          cert: expect.any(String),
          pubkey: expect.any(String)
        }
      }
    ]);
  });

  it("does not display warning text if no warning text is provided", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays warning text if warning text is provided", () => {
    setup({ warningText: "You do not have a valid local certificate" });
    expect(screen.getByRole("alert")).toHaveTextContent(/You do not have a valid local certificate/);
  });

  function setup(
    input?: CreateCertificateButtonProps & {
      walletAddress?: string;
      signAndBroadcastTx?: WalletContextType["signAndBroadcastTx"];
    }
  ) {
    const { walletAddress, signAndBroadcastTx, ...props } = input ?? {};
    return render(
      <ServicesProvider
        services={{
          certificatesService: () =>
            mock<CertificatesService>({
              getCertificates: jest.fn(async () => ({
                certificates: [],
                pagination: { next_key: "", total: "0" }
              }))
            })
        }}
      >
        <WalletProviderContext.Provider
          value={mock<WalletContextType>({
            address: walletAddress ?? "akash1234567890",
            walletName: "test",
            isWalletConnected: true,
            isWalletLoaded: true,
            signAndBroadcastTx: signAndBroadcastTx ?? jest.fn(async () => true)
          })}
        >
          <CertificateProvider>
            <CreateCertificateButton {...props} />
          </CertificateProvider>
        </WalletProviderContext.Provider>
      </ServicesProvider>
    );
  }
});
