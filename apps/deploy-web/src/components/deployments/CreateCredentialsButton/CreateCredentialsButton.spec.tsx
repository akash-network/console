import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { Props as CreateProviderCredentialsButtonProps } from "./CreateCredentialsButton";
import { CreateCredentialsButton, DEPENDENCIES as CREATE_PROVIDER_CREDENTIALS_BUTTON_DEPENDENCIES } from "./CreateCredentialsButton";

import { fireEvent, render, screen } from "@testing-library/react";

describe(CreateCredentialsButton.name, () => {
  describe("mtls credentials", () => {
    it("renders create certificate button when credentials are missing", () => {
      setup({
        providerCredentials: {
          details: {
            type: "mtls",
            value: null,
            isExpired: false,
            usable: false
          }
        }
      });

      expect(screen.getByRole("button", { name: /create certificate/i })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/You need to create a certificate to view deployment details./);
    });

    it("renders regenerate certificate button when credentials are expired", () => {
      setup({
        providerCredentials: {
          details: {
            type: "mtls",
            value: { cert: "certPem", key: "keyPem" },
            isExpired: true,
            usable: false
          }
        }
      });

      expect(screen.getByRole("button", { name: /regenerate certificate/i })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/Your certificate has expired. Please create a new one./);
    });

    it("renders nothing when credentials has type `mtls` and is usable", () => {
      setup({
        providerCredentials: {
          details: {
            type: "mtls",
            value: { cert: "certPem", key: "keyPem" },
            isExpired: false,
            usable: true
          }
        }
      });

      expect(screen.queryByRole("button", { name: /create certificate/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows spinner when generating credentials for mtls", () => {
      const generate = jest.fn(() => new Promise<void>(() => {}));
      setup({
        providerCredentials: {
          generate,
          details: {
            type: "mtls",
            value: null,
            isExpired: false,
            usable: false
          }
        }
      });

      const button = screen.getByRole("button", { name: /create certificate/i });
      fireEvent.click(button);

      expect(generate).toHaveBeenCalled();
      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("jwt credentials", () => {
    it("renders generate token button when credentials are missing", () => {
      setup({
        providerCredentials: {
          details: {
            type: "jwt",
            value: null,
            isExpired: false,
            usable: false
          }
        }
      });

      expect(screen.getByRole("button", { name: /generate token/i })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/You need to generate a token to view deployment details./);
    });

    it("renders regenerate token button when credentials are expired", () => {
      setup({
        providerCredentials: {
          details: {
            type: "jwt",
            value: "some-token",
            isExpired: true,
            usable: false
          }
        }
      });

      expect(screen.getByRole("button", { name: /regenerate token/i })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/Your token has expired. Please generate a new one./);
    });

    it("renders nothing when credentials has type `jwt` and is usable", () => {
      setup({
        providerCredentials: {
          details: {
            type: "jwt",
            value: "some-token",
            isExpired: false,
            usable: true
          }
        }
      });

      expect(screen.queryByRole("button", { name: /generate token/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows spinner when generating credentials for ", () => {
      const generate = jest.fn(() => new Promise<void>(() => {}));
      setup({
        providerCredentials: {
          generate,
          details: {
            type: "jwt",
            value: null,
            isExpired: false,
            usable: false
          }
        }
      });

      const button = screen.getByRole("button", { name: /generate token/i });
      fireEvent.click(button);

      expect(generate).toHaveBeenCalled();
      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  function setup(
    input?: CreateProviderCredentialsButtonProps & {
      providerCredentials?: Partial<UseProviderCredentialsResult>;
    }
  ) {
    const { providerCredentials, ...props } = input ?? {};

    return render(
      <CreateCredentialsButton
        {...props}
        dependencies={{
          ...CREATE_PROVIDER_CREDENTIALS_BUTTON_DEPENDENCIES,
          useProviderCredentials: () => ({
            generate: providerCredentials?.generate ?? jest.fn(() => Promise.resolve()),
            details: providerCredentials?.details ?? {
              type: "mtls",
              value: { cert: "certPem", key: "keyPem" },
              isExpired: true,
              usable: false
            }
          })
        }}
      />
    );
  }
});
