import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";

import type { CloseDeploymentTarget } from "@src/components/deployments/CloseDeploymentDialog/CloseDeploymentDialog";
import { closeDeploymentRequestAtom } from "@src/store/closeDeploymentStore";
import type { DEPENDENCIES } from "./CloseDeploymentConfirmHost";
import { CloseDeploymentConfirmHost } from "./CloseDeploymentConfirmHost";

import { act, render, screen } from "@testing-library/react";

describe("CloseDeploymentConfirmHost", () => {
  it("shows no dialog until a close is requested", () => {
    setup();

    expect(screen.queryByTestId("close-deployment-dialog")).not.toBeInTheDocument();
  });

  it("shows the dialog for the requested deployments", () => {
    const { request } = setup();

    request({ dseqs: ["1786440078202"], name: "my-service" });

    expect(screen.getByTestId("close-deployment-dialog")).toHaveTextContent("my-service 1786440078202");
  });

  it("answers the request with the confirmed reason and clears it", () => {
    const { request, store } = setup();
    const resolve = request({ dseqs: ["1786440078202"] });

    act(() => screen.getByRole("button", { name: "confirm" }).click());

    expect(resolve).toHaveBeenCalledWith({ closeReason: "cost_or_budget" });
    expect(store.get(closeDeploymentRequestAtom)).toBeNull();
    expect(screen.queryByTestId("close-deployment-dialog")).not.toBeInTheDocument();
  });

  it("answers the request with null when cancelled and clears it", () => {
    const { request, store } = setup();
    const resolve = request({ dseqs: ["1786440078202"] });

    act(() => screen.getByRole("button", { name: "cancel" }).click());

    expect(resolve).toHaveBeenCalledWith(null);
    expect(store.get(closeDeploymentRequestAtom)).toBeNull();
  });

  function setup() {
    const store = createStore();
    const dependencies: typeof DEPENDENCIES = {
      CloseDeploymentDialog: ({ target, onConfirm, onCancel }) => (
        <div data-testid="close-deployment-dialog">
          {target.name} {target.dseqs.join(",")}
          <button onClick={() => onConfirm({ closeReason: "cost_or_budget" })}>confirm</button>
          <button onClick={onCancel}>cancel</button>
        </div>
      )
    };

    render(
      <JotaiProvider store={store}>
        <CloseDeploymentConfirmHost dependencies={dependencies} />
      </JotaiProvider>
    );

    const request = (target: CloseDeploymentTarget) => {
      const resolve = vi.fn();
      act(() => store.set(closeDeploymentRequestAtom, { target, resolve }));
      return resolve;
    };

    return { store, request };
  }
});
