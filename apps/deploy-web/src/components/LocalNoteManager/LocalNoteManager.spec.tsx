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

  it("sets dseq to null when modal onSaved is called", () => {
    const DeploymentNameModalMock = vi.fn(ComponentMock as unknown as typeof DeploymentNameModal);
    const selectDeployment = vi.fn();
    setup({
      dseq: 789,
      selectDeployment,
      dependencies: {
        DeploymentNameModal: DeploymentNameModalMock
      }
    });

    act(() => {
      DeploymentNameModalMock.mock.calls[0][0].onSaved();
    });

    expect(selectDeployment).toHaveBeenCalledWith(null);
  });

  it("passes getDeploymentName from useLocalNotes to modal", () => {
    const DeploymentNameModalMock = vi.fn(ComponentMock as unknown as typeof DeploymentNameModal);
    const getDeploymentName = vi.fn().mockReturnValue("my-deployment");
    setup({
      getDeploymentName,
      dependencies: {
        DeploymentNameModal: DeploymentNameModalMock
      }
    });

    expect(DeploymentNameModalMock).toHaveBeenCalledWith(expect.objectContaining({ getDeploymentName }), expect.anything());
  });

  it("initializes favorite providers on mount", () => {
    const initFavoriteProviders = vi.fn();
    setup({ initFavoriteProviders });

    expect(initFavoriteProviders).toHaveBeenCalledTimes(1);
  });

  function setup(input?: {
    dseq?: string | number | null;
    selectDeployment?: (dseq: string | number | null) => void;
    getDeploymentName?: (dseq: string | number | null) => string | null;
    initFavoriteProviders?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const dseq = input?.dseq ?? null;
    const selectDeployment = input?.selectDeployment ?? vi.fn();
    const getDeploymentName = input?.getDeploymentName ?? vi.fn().mockReturnValue(null);
    const initFavoriteProviders = input?.initFavoriteProviders ?? vi.fn();

    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => ({
      getDeploymentName,
      changeDeploymentName: vi.fn(),
      getDeploymentData: vi.fn().mockReturnValue(null),
      favoriteProviders: [],
      updateFavoriteProviders: vi.fn(),
      selectedDeploymentDseq: dseq,
      selectDeployment
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

    return { selectDeployment, getDeploymentName, initFavoriteProviders };
  }
});
