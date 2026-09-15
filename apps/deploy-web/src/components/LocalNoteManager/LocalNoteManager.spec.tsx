import { describe, expect, it, vi } from "vitest";

import type { DeploymentNameModal } from "./DeploymentNameModal";
import { DEPENDENCIES, LocalNoteManager } from "./LocalNoteManager";

import { act, render } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(LocalNoteManager.name, () => {
  it("renders DeploymentNameModal with dseq from store", () => {
    const DeploymentNameModalMock = vi.fn(ComponentMock as unknown as typeof DeploymentNameModal);
    setup({
      dseq: 123,
      dependencies: {
        DeploymentNameModal: DeploymentNameModalMock
      }
    });

    expect(DeploymentNameModalMock).toHaveBeenCalledWith(expect.objectContaining({ dseq: 123 }), expect.anything());
  });

  it("passes null dseq to DeploymentNameModal when store has no dseq", () => {
    const DeploymentNameModalMock = vi.fn(ComponentMock as unknown as typeof DeploymentNameModal);
    setup({
      dependencies: {
        DeploymentNameModal: DeploymentNameModalMock
      }
    });

    expect(DeploymentNameModalMock).toHaveBeenCalledWith(expect.objectContaining({ dseq: null }), expect.anything());
  });

  it("sets dseq to null when modal onClose is called", () => {
    const DeploymentNameModalMock = vi.fn(ComponentMock as unknown as typeof DeploymentNameModal);
    const selectDeployment = vi.fn();
    setup({
      dseq: 456,
      selectDeployment,
      dependencies: {
        DeploymentNameModal: DeploymentNameModalMock
      }
    });

    act(() => {
      DeploymentNameModalMock.mock.calls[0][0].onClose();
    });

    expect(selectDeployment).toHaveBeenCalledWith(null);
  });

  it("deselects only the deployment whose rename was saved, so a save finishing late cannot close another", () => {
    const DeploymentNameModalMock = vi.fn(ComponentMock as unknown as typeof DeploymentNameModal);
    const selectDeployment = vi.fn();
    const deselectDeployment = vi.fn();
    setup({
      dseq: 789,
      selectDeployment,
      deselectDeployment,
      dependencies: {
        DeploymentNameModal: DeploymentNameModalMock
      }
    });

    act(() => {
      DeploymentNameModalMock.mock.calls[0][0].onSaved("123");
    });

    expect(deselectDeployment).toHaveBeenCalledWith("123");
    expect(selectDeployment).not.toHaveBeenCalled();
  });

  it("initializes favorite providers on mount", () => {
    const initFavoriteProviders = vi.fn();
    setup({ initFavoriteProviders });

    expect(initFavoriteProviders).toHaveBeenCalledTimes(1);
  });

  function setup(input?: {
    dseq?: string | number | null;
    selectDeployment?: (dseq: string | number | null) => void;
    deselectDeployment?: (dseq: string | number) => void;
    initFavoriteProviders?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const dseq = input?.dseq ?? null;
    const selectDeployment = input?.selectDeployment ?? vi.fn();
    const deselectDeployment = input?.deselectDeployment ?? vi.fn();
    const initFavoriteProviders = input?.initFavoriteProviders ?? vi.fn();

    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => ({
      changeDeploymentName: vi.fn(),
      favoriteProviders: [],
      updateFavoriteProviders: vi.fn(),
      selectedDeploymentDseq: dseq,
      selectDeployment,
      deselectDeployment
    });
    const useInitFavoriteProviders: typeof DEPENDENCIES.useInitFavoriteProviders = () => initFavoriteProviders;

    render(
      <LocalNoteManager
        dependencies={{
          ...MockComponents(DEPENDENCIES, input?.dependencies),
          useLocalNotes,
          useInitFavoriteProviders,
          ...input?.dependencies
        }}
      />
    );

    return { selectDeployment, deselectDeployment, initFavoriteProviders };
  }
});
