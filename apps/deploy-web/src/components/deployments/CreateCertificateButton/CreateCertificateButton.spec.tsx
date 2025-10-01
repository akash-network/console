import type { LocalCert } from "@src/context/CertificateProvider";
import type { LocalToken } from "@src/hooks/useJwt";
import type { Props as CreateCertificateButtonProps } from "./CreateCertificateButton";
import { CreateCertificateButton, DEPENDENCIES as CREATE_CERTIFICATE_BUTTON_DEPENDENCIES } from "./CreateCertificateButton";

import { fireEvent, render, screen } from "@testing-library/react";

describe(CreateCertificateButton.name, () => {
  it("renders create certificate button", () => {
    setup();
    expect(screen.getByRole("button", { name: /create certificate/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toHaveTextContent(/You need to create a certificate to view deployment details./);
  });

  it("renders create token button", () => {
    setup({ isJwtEnabled: true });
    expect(screen.getByRole("button", { name: /create token/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toHaveTextContent(/You need to create a token to view deployment details./);
  });

  it("calls createCertificate when clicked", async () => {
    const createCertificate = jest.fn(async () => {});
    setup({ createCertificate });

    const button = screen.getByRole("button", { name: /create certificate/i });
    fireEvent.click(button);

    expect(createCertificate).toHaveBeenCalled();
  });

  it("calls createToken when clicked", async () => {
    const createToken = jest.fn(async () => {});
    setup({ createToken, isJwtEnabled: true });

    const button = screen.getByRole("button", { name: /create token/i });
    fireEvent.click(button);

    expect(createToken).toHaveBeenCalled();
  });

  it("displays warning text if certificate is expired", () => {
    setup({
      localCert: {
        certPem: "expired",
        keyPem: "expired",
        address: "akash1234567890"
      },
      isLocalCertExpired: true
    });
    expect(screen.queryByRole("alert")).toHaveTextContent(/Your certificate has expired. Please create a new one./);
  });

  it("displays warning text if token is expired", () => {
    setup({
      localToken: {
        token: "expired",
        address: "akash1234567890"
      },
      isLocalTokenExpired: true,
      isJwtEnabled: true
    });
    expect(screen.queryByRole("alert")).toHaveTextContent(/Your token has expired. Please create a new one./);
  });

  function setup(
    input?: CreateCertificateButtonProps & {
      createCertificate?: () => Promise<void>;
      createToken?: () => Promise<void>;
      isCreatingCert?: boolean;
      isLocalCertExpired?: boolean;
      isLocalTokenExpired?: boolean;
      localCert?: LocalCert;
      localToken?: LocalToken;
      isBlockchainDown?: boolean;
      isJwtEnabled?: boolean;
    }
  ) {
    const {
      createCertificate,
      createToken,
      isCreatingCert,
      isLocalCertExpired,
      isLocalTokenExpired,
      localCert,
      localToken,
      isBlockchainDown,
      isJwtEnabled,
      ...props
    } = input ?? {};

    return render(
      <CreateCertificateButton
        {...props}
        dependencies={{
          ...CREATE_CERTIFICATE_BUTTON_DEPENDENCIES,
          useCertificate: (() => ({
            createCertificate: createCertificate ?? jest.fn(() => Promise.resolve()),
            isCreatingCert: isCreatingCert ?? false,
            isLocalCertExpired: isLocalCertExpired ?? false,
            localCert: localCert ?? null
          })) as (typeof CREATE_CERTIFICATE_BUTTON_DEPENDENCIES)["useCertificate"],
          useSettings: () => ({
            settings: {
              apiEndpoint: "https://api.example.com",
              rpcEndpoint: "https://rpc.example.com",
              isCustomNode: false,
              nodes: [],
              selectedNode: null,
              customNode: null,
              isBlockchainDown: isBlockchainDown ?? false
            },
            setSettings: jest.fn(),
            isLoadingSettings: false,
            isSettingsInit: true,
            refreshNodeStatuses: jest.fn(),
            isRefreshingNodeStatus: false
          }),
          useJwt: () => ({
            isCreatingToken: false,
            createToken: createToken ?? jest.fn(() => Promise.resolve()),
            isLocalTokenExpired: isLocalTokenExpired ?? false,
            localToken: localToken ?? null,
            setLocalToken: jest.fn()
          }),
          useFlag: jest.fn().mockImplementation(flag => {
            if (flag === "jwt_instead_of_cert") {
              return isJwtEnabled ?? false;
            }

            return false;
          })
        }}
      />
    );
  }
});
