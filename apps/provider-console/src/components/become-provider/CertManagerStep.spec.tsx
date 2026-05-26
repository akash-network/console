import "@testing-library/jest-dom";

import React from "react";
import { atom, createStore, Provider } from "jotai";

import { EMPTY_CERT_MANAGER_SECRETS, EMPTY_CERT_MANAGER_STATE } from "@src/types/certManager";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverMock });

interface ProviderProcessShape {
  config: { domain: string; organization: string; email: string };
  process: { certManager: boolean };
  certManager: typeof EMPTY_CERT_MANAGER_STATE;
}

const defaultInitial: ProviderProcessShape = {
  config: { domain: "provider.example.com", organization: "Acme", email: "" },
  process: { certManager: false },
  certManager: EMPTY_CERT_MANAGER_STATE
};

jest.mock("@src/store/providerProcessStore", () => {
  const { atom: jotaiAtom } = jest.requireActual("jotai");
  const providerProcessAtom = jotaiAtom({
    config: { domain: "provider.example.com", organization: "Acme", email: "" },
    process: { certManager: false },
    certManager: {
      acme_email: "",
      dns_provider: "",
      clouddns: { project: "" }
    }
  });
  const certManagerSecretsAtom = jotaiAtom({
    cloudflare: { api_token: "" },
    clouddns: { service_account_json: "" }
  });
  const resetProviderProcess = jotaiAtom(null, () => undefined);
  return {
    __esModule: true,
    default: { providerProcessAtom, certManagerSecretsAtom, resetProviderProcess }
  };
});

jest.mock("./ResetProviderProcess", () => ({
  __esModule: true,
  ResetProviderForm: () => <div data-testid="reset-form" />
}));

import providerProcessStore from "@src/store/providerProcessStore";
import { CertManagerStep } from "./CertManagerStep";

describe("CertManagerStep", () => {
  it("persists Cloudflare values to the secrets atom and pre-fills acme_email from provider config", async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    const { store } = setup({
      onComplete,
      initial: { ...defaultInitial, config: { ...defaultInitial.config, email: "ops@example.com" } }
    });

    expect((screen.getByPlaceholderText("ops@example.com") as HTMLInputElement).value).toBe("ops@example.com");

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByLabelText("Cloudflare API token"), "cf-token-1");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    const persisted = store.get(providerProcessStore.providerProcessAtom);
    const secrets = store.get(providerProcessStore.certManagerSecretsAtom);
    expect(persisted.process.certManager).toBe(true);
    expect(persisted.certManager.dns_provider).toBe("cloudflare");
    expect(persisted.certManager.acme_email).toBe("ops@example.com");
    // Secrets must live only in the in-memory atom, not in the persisted slice.
    expect(persisted.certManager).not.toHaveProperty("cloudflare");
    expect(secrets.cloudflare.api_token).toBe("cf-token-1");
  });

  it("splits CloudDNS submission so project persists but the service account JSON does not", async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    const { store } = setup({ onComplete });

    const json = JSON.stringify({ type: "service_account", project_id: "demo" });
    await user.click(screen.getByLabelText("Google CloudDNS"));
    await user.type(screen.getByLabelText("GCP project ID"), "my-gcp-project");
    await user.click(screen.getByLabelText("Service account JSON"));
    await user.paste(json);
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    const persisted = store.get(providerProcessStore.providerProcessAtom);
    const secrets = store.get(providerProcessStore.certManagerSecretsAtom);
    expect(persisted.certManager.dns_provider).toBe("clouddns");
    expect(persisted.certManager.clouddns).toEqual({ project: "my-gcp-project" });
    expect(secrets.clouddns.service_account_json).toBe(json);
    expect(secrets.cloudflare).toEqual(EMPTY_CERT_MANAGER_SECRETS.cloudflare);
  });

  function setup(input: { onComplete?: () => void; initial?: ProviderProcessShape }) {
    const store = createStore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set(providerProcessStore.providerProcessAtom, (input.initial ?? defaultInitial) as any);
    store.set(providerProcessStore.certManagerSecretsAtom, EMPTY_CERT_MANAGER_SECRETS);
    render(
      <Provider store={store}>
        <CertManagerStep onComplete={input.onComplete ?? jest.fn()} />
      </Provider>
    );
    return { store };
  }
});
// Suppress unused import warning when module is referenced from jest.mock factory
void atom;
