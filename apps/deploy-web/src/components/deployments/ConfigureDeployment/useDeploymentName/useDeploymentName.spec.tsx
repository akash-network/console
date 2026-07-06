import type { PropsWithChildren } from "react";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { settingsIdAtom } from "@src/context/SettingsProvider/settingsStore";
import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import type { DEPENDENCIES } from "./useDeploymentName";
import { useDeploymentName } from "./useDeploymentName";

import { act, renderHook } from "@testing-library/react";

describe(useDeploymentName.name, () => {
  it("seeds the name from initialName", () => {
    const { result } = setup({ initialName: "my-app" });

    expect(result.current.name).toBe("my-app");
  });

  it("updates the name via setName", () => {
    const { result } = setup({ initialName: "my-app" });

    act(() => result.current.setName("renamed"));

    expect(result.current.name).toBe("renamed");
  });

  it("writes the name to the settings-scoped record when a dseq is first assigned", () => {
    const { rerender, deploymentLocalStorage } = setup({ initialName: "my-app", dseq: null, settingsId: "akash1abc" });

    rerender({ initialName: "my-app", dseq: "12345" });

    expect(deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "12345", { name: "my-app" });
  });

  it("does not write before a dseq exists", () => {
    const { deploymentLocalStorage } = setup({ initialName: "my-app", dseq: null });

    expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
  });

  it("does not write when the session resumed already carrying a dseq", () => {
    const { deploymentLocalStorage } = setup({ initialName: "my-app", dseq: "12345" });

    expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
  });

  it("defers the write until settingsId is available instead of dropping it", () => {
    const { rerender, store, deploymentLocalStorage } = setup({ initialName: "my-app", dseq: null, settingsId: null });

    rerender({ initialName: "my-app", dseq: "12345" });
    expect(deploymentLocalStorage.update).not.toHaveBeenCalled();

    act(() => store.set(settingsIdAtom, "akash1abc"));

    expect(deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "12345", { name: "my-app" });
  });

  function setup(input: { initialName?: string; dseq?: string | null; settingsId?: string | null }) {
    const deploymentLocalStorage = mock<DeploymentStorageService>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ deploymentLocalStorage });

    const store = createStore();
    store.set(settingsIdAtom, input.settingsId ?? null);
    const wrapper = ({ children }: PropsWithChildren) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>;
    const initialProps = { initialName: input.initialName, dseq: input.dseq ?? null };

    return {
      ...renderHook((props: { initialName?: string; dseq: string | null }) => useDeploymentName(props, { useServices }), { wrapper, initialProps }),
      deploymentLocalStorage,
      store
    };
  }
});
