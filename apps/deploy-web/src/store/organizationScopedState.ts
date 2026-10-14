import type { createStore } from "jotai";
import { RESET } from "jotai/utils";

import { addCreditsRequestAtom } from "./addCreditsStore";
import { closeDeploymentRequestAtom } from "./closeDeploymentStore";
import sdlStore from "./sdlStore";
import { settingsIdAtom } from "./settingsStore";
import walletStore from "./walletStore";

type Store = ReturnType<typeof createStore>;

/** Drops every atom holding the previous organization's wallet, balance or half-finished flows, so nothing of it survives a switch. */
export function resetOrganizationScopedState(store: Store): void {
  store.set(settingsIdAtom, RESET);
  store.set(walletStore.balance, null);
  store.set(sdlStore.deploySdl, null);
  store.set(addCreditsRequestAtom, null);
  store.set(closeDeploymentRequestAtom, null);
}
