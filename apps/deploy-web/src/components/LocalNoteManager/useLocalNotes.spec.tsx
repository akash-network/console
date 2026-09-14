import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import { localNoteStore } from "./localNoteStore";
import { useLocalNotes } from "./useLocalNotes";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useLocalNotes.name, () => {
  it("deselects the deployment whose dseq it is given, however that dseq is typed", () => {
    const { result } = setup({ selectedDseq: 789 });

    act(() => result.current.deselectDeployment("789"));

    expect(result.current.selectedDeploymentDseq).toBeNull();
  });

  it("keeps a different deployment selected when an earlier one's save completes late", () => {
    const { result } = setup({ selectedDseq: 789 });

    act(() => result.current.deselectDeployment(123));

    expect(result.current.selectedDeploymentDseq).toBe(789);
  });

  function setup(input: { selectedDseq?: string | number | null }) {
    const store = createStore();
    store.set(localNoteStore.deploymentNameDseq, input.selectedDseq ?? null);
    const deploymentLocalStorage = mock<DeploymentStorageService>();

    return setupQuery(() => useLocalNotes(), {
      services: { deploymentLocalStorage: () => deploymentLocalStorage },
      wrapper: ({ children }) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>
    });
  }
});
