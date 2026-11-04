import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { TemplateCreation } from "@src/types";
import type { AddCreditsRequest } from "./addCreditsStore";
import { addCreditsRequestAtom } from "./addCreditsStore";
import type { CloseDeploymentRequest } from "./closeDeploymentStore";
import { closeDeploymentRequestAtom } from "./closeDeploymentStore";
import { deployTargetProjectIdAtom } from "./deployTargetStore";
import { resetOrganizationScopedState } from "./organizationScopedState";
import sdlStore from "./sdlStore";
import { settingsIdAtom } from "./settingsStore";
import walletStore from "./walletStore";

describe(resetOrganizationScopedState.name, () => {
  it("forgets the wallet address of the previous organization", () => {
    const { store } = setup();

    resetOrganizationScopedState(store);

    expect(store.get(settingsIdAtom)).toBeNull();
    expect(localStorage.getItem("akashSettingsId")).toBeNull();
  });

  it("drops the balance of the previous organization", () => {
    const { store } = setup();

    resetOrganizationScopedState(store);

    expect(store.get(walletStore.balance)).toBeNull();
  });

  it("abandons the half-finished deployment and pending dialogs of the previous organization", () => {
    const { store } = setup();

    resetOrganizationScopedState(store);

    expect(store.get(sdlStore.deploySdl)).toBeNull();
    expect(store.get(addCreditsRequestAtom)).toBeNull();
    expect(store.get(closeDeploymentRequestAtom)).toBeNull();
    expect(store.get(deployTargetProjectIdAtom)).toBeNull();
  });

  it("keeps the user's interface preferences", () => {
    const { store } = setup();
    store.set(sdlStore.sdlPreviewOpen, true);

    resetOrganizationScopedState(store);

    expect(store.get(sdlStore.sdlPreviewOpen)).toBe(true);
  });

  function setup() {
    const store = createStore();
    store.set(settingsIdAtom, "akash1previous");
    store.set(walletStore.balance, mock<WalletBalance>({ totalUsd: 42 }));
    store.set(sdlStore.deploySdl, mock<TemplateCreation>({ name: "draft" }));
    store.set(addCreditsRequestAtom, mock<AddCreditsRequest>({ context: "test" }));
    store.set(closeDeploymentRequestAtom, mock<CloseDeploymentRequest>());
    store.set(deployTargetProjectIdAtom, "project-of-the-previous-organization");

    return { store };
  }
});
