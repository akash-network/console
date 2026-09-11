import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock, mockDeep } from "vitest-mock-extended";

import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import { settingsIdAtom } from "@src/store/settingsStore";
import type { DEPENDENCIES } from "./DeploymentNameModal";
import { DeploymentNameModal } from "./DeploymentNameModal";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("DeploymentNameModal", () => {
  it("renames the deployment through the api, so the name outlives this browser", async () => {
    const { patchMutate } = setup({ resolvedName: "old-name" });

    await rename("my-app");

    expect(patchMutate).toHaveBeenCalledWith({ dseq: "12345", data: { name: "my-app" } }, expect.any(Object));
  });

  it("refreshes what the api holds for the deployment, so the detail page stops showing the old name", async () => {
    const { queryClient, api } = setup({});

    await rename("my-app");

    await waitFor(() => expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey({ dseq: "12345" }) }));
  });

  it("records the new name in this browser too, which the deployments list still reads", async () => {
    const { deploymentLocalStorage } = setup({});

    await rename("my-app");

    await waitFor(() => expect(deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "12345", { name: "my-app" }));
  });

  it("reports the rename as saved once the api accepted it", async () => {
    const { onSaved, enqueueSnackbar } = setup({});

    await rename("my-app");

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("opens on the name the api holds, not only the one this browser recorded", async () => {
    setup({ resolvedName: "named-elsewhere" });

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("named-elsewhere"));
  });

  it("caps the field at the length the api accepts", () => {
    setup({});

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("maxlength", String(MAX_DEPLOYMENT_NAME_LENGTH));
  });

  it("holds a typed-in over-long name to the length the api accepts, so the rename cannot fail on it", async () => {
    const { patchMutate } = setup({ resolvedName: "old-name" });

    await rename("a".repeat(MAX_DEPLOYMENT_NAME_LENGTH + 10));

    expect(patchMutate).toHaveBeenCalledWith({ dseq: "12345", data: { name: "a".repeat(MAX_DEPLOYMENT_NAME_LENGTH) } }, expect.any(Object));
  });

  it("refuses an over-long name that reached the field without passing its own cap", async () => {
    const { patchMutate } = setup({ resolvedName: "old-name" });

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "a".repeat(MAX_DEPLOYMENT_NAME_LENGTH + 1) } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(patchMutate).not.toHaveBeenCalled();
  });

  it("ignores a second save while the first is still in flight, so the older name cannot land last", async () => {
    const { patchMutate } = setup({ resolvedName: "old-name", isPending: true });

    await rename("my-app");

    expect(patchMutate).not.toHaveBeenCalled();
  });

  it("still refreshes and closes when this browser cannot record the new name", async () => {
    const deploymentLocalStorage = mock<DeploymentStorageService>();
    deploymentLocalStorage.update.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { queryClient, onSaved } = setup({ deploymentLocalStorage });

    await rename("my-app");

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });

  it.each(["", "   "])("refuses a name of %p, which the api rejects rather than reading as unnamed", async typed => {
    const { patchMutate, deploymentLocalStorage, onSaved } = setup({ resolvedName: "old-name" });

    await rename(typed);

    expect(patchMutate).not.toHaveBeenCalled();
    expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and reports a failed rename instead of claiming success", async () => {
    const patchMutate = vi.fn((_variables, options) => options?.onError?.(new Error("nope")));
    const { onSaved, deploymentLocalStorage, enqueueSnackbar } = setup({ patchMutate });

    await rename("my-app");

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" })));
    expect(onSaved).not.toHaveBeenCalled();
    expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
  });

  it("opens on the name of the deployment it was reopened for, not the one typed for another", async () => {
    const { showDeployment } = setup({ dseq: "12345", resolvedName: "first-deployment" });
    await type("typed-for-the-first");

    showDeployment({ dseq: "67890", resolvedName: "second-deployment" });

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("second-deployment"));
  });

  it("renames the deployment it was reopened for with that deployment's own name", async () => {
    const { showDeployment, patchMutate } = setup({ dseq: "12345", resolvedName: "first-deployment" });
    await type("typed-for-the-first");

    showDeployment({ dseq: "67890", resolvedName: "second-deployment" });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(patchMutate).toHaveBeenCalledWith({ dseq: "67890", data: { name: "second-deployment" } }, expect.any(Object));
  });

  it("opens on the deployment's own name once an edit was abandoned by closing the dialog", async () => {
    const { showDeployment } = setup({ dseq: "12345", resolvedName: "old-name" });
    await type("abandoned");

    showDeployment({ dseq: null, resolvedName: "old-name" });
    showDeployment({ dseq: "12345", resolvedName: "old-name" });

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("old-name"));
  });

  it("keeps what the user typed when the api's name for the same deployment arrives afterwards", async () => {
    const { showDeployment } = setup({ dseq: "12345" });
    await type("typed-while-loading");

    showDeployment({ dseq: "12345", resolvedName: "named-elsewhere" });

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("typed-while-loading");
  });

  async function type(name: string) {
    const field = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(field);
    await userEvent.type(field, name);
  }

  async function rename(name: string) {
    const field = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(field);
    if (name) await userEvent.type(field, name);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
  }

  function setup(input: {
    dseq?: string | null;
    resolvedName?: string;
    patchMutate?: ReturnType<typeof vi.fn>;
    isPending?: boolean;
    deploymentLocalStorage?: MockProxy<DeploymentStorageService>;
  }) {
    const dseq = input.dseq === undefined ? "12345" : input.dseq;
    const patchMutate = input.patchMutate ?? vi.fn((_variables, options) => options?.onSuccess?.());

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.getDeployment.getKey.mockImplementation(request => ["getDeployment", request?.dseq ?? ""]);
    api.v1.patchDeployment.useMutation.mockReturnValue(
      mock<ReturnType<typeof api.v1.patchDeployment.useMutation>>({ mutate: patchMutate as never, isPending: input.isPending ?? false })
    );

    const deploymentLocalStorage = input.deploymentLocalStorage ?? mock<DeploymentStorageService>();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const enqueueSnackbar = vi.fn();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    let resolvedName = input.resolvedName;
    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
      useQueryClient: () => queryClient,
      useResolvedDeploymentName: () => resolvedName
    };

    const store = createStore();
    store.set(settingsIdAtom, "akash1abc");

    const modalFor = (shownDseq: string | number | null) => (
      <JotaiStoreProvider store={store}>
        <TestContainerProvider services={{ api: () => api, deploymentLocalStorage: () => deploymentLocalStorage }}>
          <DeploymentNameModal dseq={shownDseq} onClose={onClose} onSaved={onSaved} dependencies={dependencies} />
        </TestContainerProvider>
      </JotaiStoreProvider>
    );
    const { rerender } = render(modalFor(dseq));

    const showDeployment = (shown: { dseq: string | number | null; resolvedName?: string }) => {
      resolvedName = shown.resolvedName;
      rerender(modalFor(shown.dseq));
    };

    return { patchMutate, deploymentLocalStorage, queryClient, enqueueSnackbar, onSaved, onClose, api, showDeployment };
  }
});
